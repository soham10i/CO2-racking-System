package com.co2tracker.insights;

import com.co2tracker.activity.Activity;
import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.emission.Category;
import com.co2tracker.emission.EmissionEngine;
import com.co2tracker.emission.EmissionFactor;
import com.co2tracker.emission.FactorService;
import com.co2tracker.insights.InsightsDtos.ActionsResponse;
import com.co2tracker.insights.InsightsDtos.ReductionAction;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What-if reductions from the user's own recent activities: each one recomputes the logged entries with an
 * alternative factor (or a stated share), so the saving uses exactly the calculator's numbers. docs/05 section 7.
 */
@Service
@Transactional(readOnly = true)
public class ActionsService {

    static final int WINDOW_DAYS = 90;
    static final int MIN_WINDOW_DAYS = 7;
    /** Actions saving less than this per year are noise and are not shown. */
    static final BigDecimal MIN_SAVING_KG = BigDecimal.ONE;

    private static final Set<String> CARS = Set.of("CAR_PETROL", "CAR_DIESEL", "CAR_HYBRID", "CAR_EV");
    private static final Set<String> COMBUSTION_CARS = Set.of("CAR_PETROL", "CAR_DIESEL", "CAR_HYBRID");
    private static final Set<String> RED_MEAT = Set.of("MEAL_BEEF", "MEAL_LAMB");
    private static final BigDecimal QUARTER = new BigDecimal("0.25");
    private static final BigDecimal HALF = new BigDecimal("0.5");
    private static final BigDecimal TENTH = new BigDecimal("0.1");

    private final ActivityRepository activities;
    private final FactorService factors;
    private final EmissionEngine engine;
    private final UserCalendar calendar;

    public ActionsService(ActivityRepository activities, FactorService factors, EmissionEngine engine,
            UserCalendar calendar) {
        this.activities = activities;
        this.factors = factors;
        this.engine = engine;
        this.calendar = calendar;
    }

    public ActionsResponse actions(UUID userId) {
        UserProfile p = calendar.profile(userId);
        LocalDate today = calendar.today(p);
        LocalDate first = activities.firstDay(userId);
        if (first == null) {
            return new ActionsResponse(0, today, today, List.of());
        }
        // Like the benchmarks: annualise over the days actually tracked, but never fewer than a week.
        long tracked = ChronoUnit.DAYS.between(first, today) + 1;
        int window = (int) Math.max(MIN_WINDOW_DAYS, Math.min(WINDOW_DAYS, tracked));
        LocalDate from = today.minusDays(window - 1L);
        List<Activity> recent = activities.findByUserIdAndOccurredOnBetween(userId, from, today);
        Ctx ctx = new Ctx(recent, p.getCountry(), today, window);

        List<ReductionAction> out = new ArrayList<>();
        ctx.swap("car_to_train", Category.TRANSPORT, CARS, "TRAIN_REGIONAL", QUARTER,
                "Take the train for a quarter of your car trips",
                "Recomputes a quarter of your car kilometres with the regional-train factor.", "km by car")
                .ifPresent(out::add);
        ctx.swap("car_to_ev", Category.TRANSPORT, COMBUSTION_CARS, "CAR_EV", BigDecimal.ONE,
                "Drive an electric car",
                "Recomputes your combustion-car kilometres with the electric-car factor for your grid.", "km by car")
                .ifPresent(out::add);
        ctx.swap("flight_to_train", Category.TRANSPORT, Set.of("FLIGHT_SHORT"), "TRAIN_LONG", BigDecimal.ONE,
                "Take the train instead of short-haul flights",
                "Recomputes your short-haul flight kilometres with the long-distance-train factor. Realistic for "
                        + "trips up to roughly a day by rail.", "km flown short-haul")
                .ifPresent(out::add);
        ctx.swap("red_meat_to_vegetarian", Category.DIET, RED_MEAT, "MEAL_VEGETARIAN", HALF,
                "Make half of your beef and lamb meals vegetarian",
                "Recomputes half of those meals with the vegetarian-meal factor.", "beef or lamb meals")
                .ifPresent(out::add);
        ctx.swap("red_meat_to_poultry", Category.DIET, RED_MEAT, "MEAL_POULTRY", BigDecimal.ONE,
                "Swap beef and lamb for poultry",
                "Recomputes every beef and lamb meal with the poultry-meal factor.", "beef or lamb meals")
                .ifPresent(out::add);
        ctx.swap("landfill_to_recycling", Category.WASTE, Set.of("LANDFILL"), "RECYCLING", HALF,
                "Recycle half of what goes to landfill",
                "Recomputes half of your landfill waste with the recycling factor.", "kg to landfill")
                .ifPresent(out::add);
        ctx.cut("energy_cut", Category.ENERGY, TENTH, "Use 10% less home energy",
                "Ten percent of your logged electricity and heating. Electricity is counted location-based, so a "
                        + "green tariff alone does not change this figure.")
                .ifPresent(out::add);

        out.sort(Comparator.comparing(ReductionAction::annualSavingKg).reversed());
        return new ActionsResponse(window, from, today, out);
    }

    /** One evaluation: the recent activities, the factor date and the annualisation window. */
    private final class Ctx {
        private final List<Activity> recent;
        private final String country;
        private final LocalDate on;
        private final int window;

        Ctx(List<Activity> recent, String country, LocalDate on, int window) {
            this.recent = recent;
            this.country = country;
            this.on = on;
            this.window = window;
        }

        /** Saving = share × Σ (logged kg − the same quantity under the alternative factor). */
        Optional<ReductionAction> swap(String key, Category c, Set<String> from, String to, BigDecimal share,
                String title, String description, String unitLabel) {
            List<Activity> matching = recent.stream().filter(a -> a.getCategory() == c && from.contains(a.getSubtype()))
                    .toList();
            if (matching.isEmpty()) {
                return Optional.empty();
            }
            Optional<EmissionFactor> alt = factors.resolve(c, to, country, on);
            if (alt.isEmpty()) {
                return Optional.empty();
            }
            BigDecimal saved = BigDecimal.ZERO;
            for (Activity a : matching) {
                // Trains, buses and meals are per person: only shared car trips divide by passengers.
                int people = alt.get().isShareable() ? a.getPassengers() : 1;
                saved = saved.add(a.getKgCo2e().subtract(engine.kgCo2e(alt.get(), a.getQuantity(), people)));
            }
            BigDecimal quantity = sum(matching, Activity::getQuantity);
            return action(key, c, title, description, saved.multiply(share),
                    quantity.stripTrailingZeros().toPlainString() + " " + unitLabel);
        }

        /** Saving = share × Σ logged kg in the category. */
        Optional<ReductionAction> cut(String key, Category c, BigDecimal share, String title, String description) {
            List<Activity> matching = recent.stream().filter(a -> a.getCategory() == c).toList();
            if (matching.isEmpty()) {
                return Optional.empty();
            }
            BigDecimal kg = sum(matching, Activity::getKgCo2e);
            return action(key, c, title, description, kg.multiply(share),
                    kg.setScale(1, RoundingMode.HALF_EVEN).toPlainString() + " kg CO2e of home energy");
        }

        private Optional<ReductionAction> action(String key, Category c, String title, String description,
                BigDecimal savedInWindow, String what) {
            BigDecimal annual = savedInWindow.multiply(BigDecimal.valueOf(365))
                    .divide(BigDecimal.valueOf(window), 1, RoundingMode.HALF_EVEN);
            if (annual.compareTo(MIN_SAVING_KG) < 0) {
                return Optional.empty();
            }
            return Optional.of(new ReductionAction(key, c, title, description, annual,
                    "Based on " + what + " in the last " + window + " days, scaled to a year"));
        }
    }

    private static BigDecimal sum(List<Activity> list, Function<Activity, BigDecimal> f) {
        return list.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
