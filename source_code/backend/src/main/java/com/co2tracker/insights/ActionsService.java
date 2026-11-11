package com.co2tracker.insights;

import com.co2tracker.activity.Activity;
import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.common.ApiException;
import com.co2tracker.emission.Category;
import com.co2tracker.emission.EmissionEngine;
import com.co2tracker.emission.EmissionFactor;
import com.co2tracker.emission.FactorService;
import com.co2tracker.insights.ActionDecision.Status;
import com.co2tracker.insights.InsightsDtos.ActionsResponse;
import com.co2tracker.insights.InsightsDtos.Commitment;
import com.co2tracker.insights.InsightsDtos.HiddenAction;
import com.co2tracker.insights.InsightsDtos.ReductionAction;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What-if reductions from the user's own recent activities: each one recomputes the logged entries with an
 * alternative factor (or a stated share), so the saving uses exactly the calculator's numbers. docs/05 section 7.
 * The user can adopt, dismiss or snooze each one; adopted actions are tracked against their expected saving.
 */
@Service
@Transactional(readOnly = true)
public class ActionsService {

    static final int WINDOW_DAYS = 90;
    static final int MIN_WINDOW_DAYS = 7;
    /** Realised savings are only reported once this many days have passed since adoption. */
    static final int MIN_TRACKING_DAYS = 7;
    static final int DEFAULT_SNOOZE_DAYS = 30;
    /** Actions saving less than this per year are noise and are not shown. */
    static final BigDecimal MIN_SAVING_KG = BigDecimal.ONE;

    private static final Set<String> CARS = Set.of("CAR_PETROL", "CAR_DIESEL", "CAR_HYBRID", "CAR_EV");
    private static final Set<String> COMBUSTION_CARS = Set.of("CAR_PETROL", "CAR_DIESEL", "CAR_HYBRID");
    private static final Set<String> RED_MEAT = Set.of("MEAL_BEEF", "MEAL_LAMB");
    private static final BigDecimal QUARTER = new BigDecimal("0.25");
    private static final BigDecimal HALF = new BigDecimal("0.5");
    private static final BigDecimal TENTH = new BigDecimal("0.1");

    /**
     * One action. A swap ({@code to != null}) recomputes {@code share} of the {@code from} entries with the
     * {@code to} factor; a cut ({@code from == null}) removes {@code share} of the whole category.
     */
    record Spec(String key, Category category, Set<String> from, String to, BigDecimal share, String title,
            String description, String unitLabel) {

        /** Entries whose kg move when the action is followed: the old and the new mode, or the whole category. */
        boolean inScope(Activity a) {
            return a.getCategory() == category
                    && (from == null || from.contains(a.getSubtype()) || a.getSubtype().equals(to));
        }
    }

    static final List<Spec> SPECS = List.of(
            new Spec("car_to_train", Category.TRANSPORT, CARS, "TRAIN_REGIONAL", QUARTER,
                    "Take the train for a quarter of your car trips",
                    "Recomputes a quarter of your car kilometres with the regional-train factor.", "km by car"),
            new Spec("car_to_ev", Category.TRANSPORT, COMBUSTION_CARS, "CAR_EV", BigDecimal.ONE,
                    "Drive an electric car",
                    "Recomputes your combustion-car kilometres with the electric-car factor for your grid.",
                    "km by car"),
            new Spec("flight_to_train", Category.TRANSPORT, Set.of("FLIGHT_SHORT"), "TRAIN_LONG", BigDecimal.ONE,
                    "Take the train instead of short-haul flights",
                    "Recomputes your short-haul flight kilometres with the long-distance-train factor. Realistic "
                            + "for trips up to roughly a day by rail.", "km flown short-haul"),
            new Spec("red_meat_to_vegetarian", Category.DIET, RED_MEAT, "MEAL_VEGETARIAN", HALF,
                    "Make half of your beef and lamb meals vegetarian",
                    "Recomputes half of those meals with the vegetarian-meal factor.", "beef or lamb meals"),
            new Spec("red_meat_to_poultry", Category.DIET, RED_MEAT, "MEAL_POULTRY", BigDecimal.ONE,
                    "Swap beef and lamb for poultry",
                    "Recomputes every beef and lamb meal with the poultry-meal factor.", "beef or lamb meals"),
            new Spec("landfill_to_recycling", Category.WASTE, Set.of("LANDFILL"), "RECYCLING", HALF,
                    "Recycle half of what goes to landfill",
                    "Recomputes half of your landfill waste with the recycling factor.", "kg to landfill"),
            new Spec("energy_cut", Category.ENERGY, null, null, TENTH, "Use 10% less home energy",
                    "Ten percent of your logged electricity and heating. Electricity is counted location-based, so "
                            + "a green tariff alone does not change this figure.", null));

    private static final Map<String, Spec> BY_KEY = SPECS.stream()
            .collect(Collectors.toMap(Spec::key, Function.identity()));

    private final ActivityRepository activities;
    private final ActionDecisionRepository decisions;
    private final FactorService factors;
    private final EmissionEngine engine;
    private final UserCalendar calendar;
    private final Clock clock;

    public ActionsService(ActivityRepository activities, ActionDecisionRepository decisions, FactorService factors,
            EmissionEngine engine, UserCalendar calendar, Clock clock) {
        this.activities = activities;
        this.decisions = decisions;
        this.factors = factors;
        this.engine = engine;
        this.calendar = calendar;
        this.clock = clock;
    }

    public ActionsResponse actions(UUID userId) {
        UserProfile p = calendar.profile(userId);
        LocalDate today = calendar.today(p);
        Window w = window(userId, p, today);
        Map<String, ActionDecision> decided = decisions.findByUserId(userId).stream()
                .collect(Collectors.toMap(ActionDecision::getActionKey, Function.identity()));

        List<ReductionAction> open = w.suggestions().stream()
                .filter(a -> !hides(decided.get(a.key()), today)).toList();
        List<Commitment> commitments = new ArrayList<>();
        List<HiddenAction> hidden = new ArrayList<>();
        for (ActionDecision d : decided.values()) {
            Spec spec = BY_KEY.get(d.getActionKey());
            if (spec == null) {
                continue; // an action retired since the decision; nothing to show
            }
            if (d.getStatus() == Status.ADOPTED) {
                commitments.add(commitment(userId, spec, d, today));
            } else if (hides(d, today)) {
                hidden.add(new HiddenAction(spec.key(), spec.category(), spec.title(), d.getStatus(),
                        d.getSnoozedUntil()));
            }
        }
        commitments.sort(Comparator.comparing(Commitment::adoptedOn).reversed());
        hidden.sort(Comparator.comparing(HiddenAction::title));
        return new ActionsResponse(w.days(), w.from(), today, open, commitments, hidden);
    }

    /** Adopting needs the action to be currently suggested, because its expected saving is captured then. */
    @Transactional
    public ActionsResponse decide(UUID userId, String key, Status status, Integer snoozeDays) {
        Spec spec = spec(key);
        UserProfile p = calendar.profile(userId);
        LocalDate today = calendar.today(p);
        Instant now = clock.instant();
        ActionDecision d = decisions.findByUserIdAndActionKey(userId, key).orElseGet(() -> {
            ActionDecision n = new ActionDecision();
            n.setId(UUID.randomUUID());
            n.setUserId(userId);
            n.setActionKey(key);
            n.setCreatedAt(now);
            return n;
        });
        d.setStatus(status);
        d.setDecidedOn(today);
        d.setSnoozedUntil(status == Status.SNOOZED
                ? today.plusDays(snoozeDays == null ? DEFAULT_SNOOZE_DAYS : snoozeDays) : null);
        d.setExpectedAnnualKg(null);
        d.setBaselineKgPerDay(null);
        if (status == Status.ADOPTED) {
            Window w = window(userId, p, today);
            ReductionAction suggestion = w.suggestions().stream().filter(a -> a.key().equals(key)).findFirst()
                    .orElseThrow(() -> ApiException.unprocessable("action_not_applicable",
                            "This action does not apply to your recent activities"));
            d.setExpectedAnnualKg(suggestion.annualSavingKg());
            d.setBaselineKgPerDay(perDay(sum(w.recent().stream().filter(spec::inScope).toList(),
                    Activity::getKgCo2e), w.days()));
        }
        d.setUpdatedAt(now);
        decisions.save(d);
        return actions(userId);
    }

    /** Undo: the action becomes an open suggestion again (if it still applies). */
    @Transactional
    public ActionsResponse reset(UUID userId, String key) {
        spec(key);
        decisions.findByUserIdAndActionKey(userId, key).ifPresent(decisions::delete);
        decisions.flush();
        return actions(userId);
    }

    // ---- helpers -----------------------------------------------------------------------------

    private static Spec spec(String key) {
        Spec spec = BY_KEY.get(key);
        if (spec == null) {
            throw ApiException.notFound("No such action");
        }
        return spec;
    }

    private static boolean hides(ActionDecision d, LocalDate today) {
        if (d == null) {
            return false;
        }
        return d.getStatus() != Status.SNOOZED || d.getSnoozedUntil().isAfter(today);
    }

    private Commitment commitment(UUID userId, Spec spec, ActionDecision d, LocalDate today) {
        LocalDate since = d.getDecidedOn();
        int days = (int) ChronoUnit.DAYS.between(since, today) + 1;
        BigDecimal realised = null;
        String basis;
        if (days < MIN_TRACKING_DAYS || d.getBaselineKgPerDay() == null) {
            basis = "Measuring: your first comparison appears after " + MIN_TRACKING_DAYS + " days";
        } else {
            BigDecimal now = perDay(sum(activities.findByUserIdAndOccurredOnBetween(userId, since, today).stream()
                    .filter(spec::inScope).toList(), Activity::getKgCo2e), days);
            realised = d.getBaselineKgPerDay().subtract(now).multiply(BigDecimal.valueOf(365))
                    .setScale(1, RoundingMode.HALF_EVEN);
            basis = "Logged " + scopeLabel(spec) + " per day over the " + days + " days since adopting, against the "
                    + "days before it, scaled to a year. Fewer entries also lower this figure.";
        }
        return new Commitment(spec.key(), spec.category(), spec.title(), since, days, d.getExpectedAnnualKg(),
                realised, basis);
    }

    private static String scopeLabel(Spec spec) {
        return spec.from() == null ? "home-energy kg" : "kg for these trips or meals";
    }

    private static BigDecimal perDay(BigDecimal kg, int days) {
        return kg.divide(BigDecimal.valueOf(days), 4, RoundingMode.HALF_EVEN);
    }

    /** The recent activities, the annualisation window and the suggestions computed from them. */
    private record Window(int days, LocalDate from, List<Activity> recent, List<ReductionAction> suggestions) {
    }

    private Window window(UUID userId, UserProfile p, LocalDate today) {
        LocalDate first = activities.firstDay(userId);
        if (first == null) {
            return new Window(0, today, List.of(), List.of());
        }
        // Like the benchmarks: annualise over the days actually tracked, but never fewer than a week.
        long tracked = ChronoUnit.DAYS.between(first, today) + 1;
        int days = (int) Math.max(MIN_WINDOW_DAYS, Math.min(WINDOW_DAYS, tracked));
        LocalDate from = today.minusDays(days - 1L);
        List<Activity> recent = activities.findByUserIdAndOccurredOnBetween(userId, from, today);
        Ctx ctx = new Ctx(recent, p.getCountry(), today, days);
        List<ReductionAction> out = new ArrayList<>();
        for (Spec s : SPECS) {
            (s.to() == null ? ctx.cut(s) : ctx.swap(s)).ifPresent(out::add);
        }
        out.sort(Comparator.comparing(ReductionAction::annualSavingKg).reversed());
        return new Window(days, from, recent, out);
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
        Optional<ReductionAction> swap(Spec s) {
            List<Activity> matching = recent.stream()
                    .filter(a -> a.getCategory() == s.category() && s.from().contains(a.getSubtype())).toList();
            if (matching.isEmpty()) {
                return Optional.empty();
            }
            Optional<EmissionFactor> alt = factors.resolve(s.category(), s.to(), country, on);
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
            return action(s, saved.multiply(s.share()),
                    quantity.stripTrailingZeros().toPlainString() + " " + s.unitLabel());
        }

        /** Saving = share × Σ logged kg in the category. */
        Optional<ReductionAction> cut(Spec s) {
            List<Activity> matching = recent.stream().filter(a -> a.getCategory() == s.category()).toList();
            if (matching.isEmpty()) {
                return Optional.empty();
            }
            BigDecimal kg = sum(matching, Activity::getKgCo2e);
            return action(s, kg.multiply(s.share()),
                    kg.setScale(1, RoundingMode.HALF_EVEN).toPlainString() + " kg CO2e of home energy");
        }

        private Optional<ReductionAction> action(Spec s, BigDecimal savedInWindow, String what) {
            BigDecimal annual = savedInWindow.multiply(BigDecimal.valueOf(365))
                    .divide(BigDecimal.valueOf(window), 1, RoundingMode.HALF_EVEN);
            if (annual.compareTo(MIN_SAVING_KG) < 0) {
                return Optional.empty();
            }
            return Optional.of(new ReductionAction(s.key(), s.category(), s.title(), s.description(), annual,
                    "Based on " + what + " in the last " + window + " days, scaled to a year"));
        }
    }

    private static BigDecimal sum(List<Activity> list, Function<Activity, BigDecimal> f) {
        return list.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
