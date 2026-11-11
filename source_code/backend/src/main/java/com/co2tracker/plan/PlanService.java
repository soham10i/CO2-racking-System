package com.co2tracker.plan;

import com.co2tracker.activity.Activity;
import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.common.ApiException;
import com.co2tracker.emission.Category;
import com.co2tracker.emission.EmissionEngine;
import com.co2tracker.emission.EmissionFactor;
import com.co2tracker.emission.FactorService;
import com.co2tracker.grid.GridDtos.GridSignal;
import com.co2tracker.grid.GridDtos.Window;
import com.co2tracker.grid.GridSignalService;
import com.co2tracker.plan.PlanDtos.Card;
import com.co2tracker.plan.PlanDtos.CardStatus;
import com.co2tracker.plan.PlanDtos.Effort;
import com.co2tracker.plan.PlanDtos.Per;
import com.co2tracker.plan.PlanDtos.PlanResponse;
import com.co2tracker.plan.PlanDtos.Saving;
import com.co2tracker.plan.PlanDtos.Slot;
import com.co2tracker.plan.PlanDtos.SourceRef;
import com.co2tracker.plan.PlanFeedback.Event;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
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
 * Today's plan: at most three cards, one per category, ranked by expected impact, plasticity, the user's own
 * success with the category, effort, timing and personalisation (docs/11 sections 4 and 5). Savings come from the
 * user's own logs and the factor table wherever possible, so they match the calculator.
 */
@Service
@Transactional(readOnly = true)
public class PlanService {

    static final int WINDOW_DAYS = 90;
    static final int FLIGHT_WINDOW_DAYS = 365;
    static final int MAX_CARDS = 3;
    static final int MAX_IF_THEN = 200;
    /** Up to 30 % direct rebound [12]: low = high × 0.7. */
    static final BigDecimal REBOUND_KEEP = new BigDecimal("0.7");
    /** Marginal-emission reduction from shifting EV charging, 5-year average for Germany [6]. */
    static final BigDecimal EV_SHIFT_REDUCTION = new BigDecimal("0.31");
    /** Assumption (docs/11 section 4): one appliance cycle uses 1 kWh. Labelled as an estimate. */
    static final BigDecimal KWH_PER_CYCLE = BigDecimal.ONE;
    /** Avoided return flight, kg CO2e: medium-haul median 0.6 t, long-haul median 1.7 t [1]. */
    static final BigDecimal MEDIUM_HAUL_FLIGHT_KG = new BigDecimal("600");
    static final BigDecimal LONG_HAUL_FLIGHT_KG = new BigDecimal("1700");

    // Ranking weights and per-effort parameters: assumptions, to be tuned against adoption (docs/11 section 5).
    static final double W_IMPACT = 0.45;
    static final double W_SUCCESS = 0.15;
    static final double W_COST = 0.15;
    static final double W_TIMING = 0.15;
    static final double W_PERSONAL = 0.10;

    private static final LocalTime MIDDAY_FROM = LocalTime.of(11, 0);
    private static final LocalTime MIDDAY_UNTIL = LocalTime.of(15, 0);
    private static final LocalTime EVENING_FROM = LocalTime.of(17, 0);

    private static final Set<String> CARS = Set.of("CAR_PETROL", "CAR_DIESEL", "CAR_HYBRID", "CAR_EV");
    /** The public and active modes a car trip can be swapped for. */
    private static final List<String> PUBLIC_OR_ACTIVE = List.of("TRAIN_REGIONAL", "BUS", "TRAM_SUBWAY", "BIKE_WALK");
    private static final Set<String> RED_MEAT = Set.of("MEAL_BEEF", "MEAL_LAMB");
    private static final Set<String> FLIGHTS = Set.of("FLIGHT_SHORT", "FLIGHT_LONG");
    private static final BigDecimal MEALS_PER_DAY = BigDecimal.valueOf(3);
    private static final BigDecimal DAYS_PER_YEAR = BigDecimal.valueOf(365);
    private static final SourceRef ENERGY_CHARTS = new SourceRef(GridSignalService.ATTRIBUTION, "live");

    /** The candidate actions of docs/11 section 4. A null slot means "in the cleanest grid window". */
    enum Action {
        COMMUTE_SWAP(Category.TRANSPORT, Slot.MORNING, Effort.MEDIUM,
                "If I leave for my usual trip, then I take the alternative instead of the car."),
        MEAL_SWAP(Category.DIET, Slot.MIDDAY, Effort.LOW,
                "If it is lunchtime, then I choose the vegetarian option."),
        PLANT_DAY(Category.DIET, Slot.MIDDAY, Effort.MEDIUM,
                "If I plan today's meals, then I pick plant-based dishes for all three."),
        SHIFT_APPLIANCE(Category.ENERGY, null, Effort.LOW,
                "If the clean window starts, then I start the washing machine or dishwasher."),
        EV_CHARGE_WINDOW(Category.TRANSPORT, null, Effort.LOW,
                "If the clean window starts, then I plug in the car."),
        TRAIN_NOT_PLANE(Category.TRANSPORT, Slot.ANYTIME, Effort.HIGH,
                "If I plan my next trip, then I check the train first.");

        final Category category;
        final Slot slot;
        final Effort effort;
        final String ifThen;

        Action(Category category, Slot slot, Effort effort, String ifThen) {
            this.category = category;
            this.slot = slot;
            this.effort = effort;
            this.ifThen = ifThen;
        }

        static Optional<Action> find(String key) {
            for (Action a : values()) {
                if (a.name().equals(key)) {
                    return Optional.of(a);
                }
            }
            return Optional.empty();
        }

        static Action of(String key) {
            return find(key).orElseThrow(() -> ApiException.notFound("No such plan card"));
        }
    }

    /** A card that applies today, before ranking. */
    record Candidate(Action action, Slot slot, String title, String detail, String whyNow, BigDecimal highKg,
            Per per, boolean personalised, List<SourceRef> sources) {

        double yearlyKg() {
            return (per == Per.TODAY ? highKg.multiply(DAYS_PER_YEAR) : highKg).doubleValue();
        }
    }

    private final ActivityRepository activities;
    private final PlanFeedbackRepository feedback;
    private final FactorService factors;
    private final EmissionEngine engine;
    private final GridSignalService grid;
    private final UserCalendar calendar;
    private final Clock clock;

    public PlanService(ActivityRepository activities, PlanFeedbackRepository feedback, FactorService factors,
            EmissionEngine engine, GridSignalService grid, UserCalendar calendar, Clock clock) {
        this.activities = activities;
        this.feedback = feedback;
        this.factors = factors;
        this.engine = engine;
        this.grid = grid;
        this.calendar = calendar;
        this.clock = clock;
    }

    public PlanResponse today(UUID userId) {
        UserProfile p = calendar.profile(userId);
        ZoneId zone = UserCalendar.zoneOf(p);
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalTime time = LocalTime.ofInstant(now, zone);
        GridSignal signal = grid.current();

        List<Activity> year = activities.findByUserIdAndOccurredOnBetween(userId,
                today.minusDays(FLIGHT_WINDOW_DAYS - 1L), today);
        LocalDate from = today.minusDays(WINDOW_DAYS - 1L);
        List<Activity> recent = year.stream().filter(a -> !a.getOccurredOn().isBefore(from)).toList();
        Ctx ctx = new Ctx(recent, year, p.getCountry(), today, zone, signal);

        Map<Action, List<PlanFeedback>> history = new LinkedHashMap<>();
        List<PlanFeedback> all = feedback.findByUserIdOrderByCreatedAtAsc(userId);
        for (PlanFeedback f : all) {
            Action.find(f.getActionKey()) // a key retired since the feedback is ignored
                    .ifPresent(a -> history.computeIfAbsent(a, k -> new ArrayList<>()).add(f));
        }

        List<Candidate> candidates = new ArrayList<>();
        for (Action a : Action.values()) {
            ctx.candidate(a).filter(c -> !hidden(history.getOrDefault(a, List.of()), today, zone))
                    .ifPresent(candidates::add);
        }
        double maxImpact = candidates.stream()
                .mapToDouble(c -> c.yearlyKg() * plasticity(c.action().effort)).max().orElse(0);

        record Ranked(Candidate c, double score) {
        }
        List<Ranked> ranked = candidates.stream()
                .map(c -> new Ranked(c, score(c, maxImpact, successPrior(all, c.action().category), time)))
                .sorted(Comparator.comparingDouble(Ranked::score).reversed()
                        .thenComparing(r -> r.c().action().ordinal()))
                .toList();

        // Diversity: the best card of each category, never more than three in all [33], [34].
        Set<Category> used = EnumSet.noneOf(Category.class);
        List<Card> cards = new ArrayList<>();
        for (Ranked r : ranked) {
            if (cards.size() < MAX_CARDS && used.add(r.c().action().category)) {
                cards.add(card(r.c(), r.score(), history.getOrDefault(r.c().action(), List.of())));
            }
        }
        return new PlanResponse(today, cards, signal);
    }

    @Transactional
    public void feedback(UUID userId, String key, Event event, String ifThen) {
        Action action = Action.of(key);
        String note = ifThen == null || ifThen.isBlank() ? null : ifThen.strip();
        if (note != null && note.length() > MAX_IF_THEN) {
            throw ApiException.badRequest("if_then_too_long",
                    "The if-then plan must be at most " + MAX_IF_THEN + " characters");
        }
        PlanFeedback f = new PlanFeedback();
        f.setId(UUID.randomUUID());
        f.setUserId(userId);
        f.setActionKey(action.name());
        f.setCategory(action.category);
        f.setEvent(event);
        f.setNote(note);
        f.setCreatedAt(clock.instant());
        feedback.save(f);
    }

    // ---- ranking (docs/11 section 5) ---------------------------------------------------------

    /** score = w1·(I·P)^ + w2·S − w3·C + w4·X + w5·R; fatigue (F) removes the card before ranking. */
    static double score(Candidate c, double maxImpact, double success, LocalTime now) {
        double impact = maxImpact <= 0 ? 0 : c.yearlyKg() * plasticity(c.action().effort) / maxImpact;
        double timing = slotAhead(c.slot(), now) ? 1 : 0.3;
        double personal = c.personalised() ? 1 : 0.5;
        return W_IMPACT * impact + W_SUCCESS * success - W_COST * cost(c.action().effort) + W_TIMING * timing
                + W_PERSONAL * personal;
    }

    /** Assumption: the plasticity concept is from [35]; the per-effort values are parameters. */
    static double plasticity(Effort e) {
        return switch (e) {
            case LOW -> 0.8;
            case MEDIUM -> 0.5;
            case HIGH -> 0.25;
        };
    }

    static double cost(Effort e) {
        return switch (e) {
            case LOW -> 0;
            case MEDIUM -> 0.5;
            case HIGH -> 1;
        };
    }

    /** Beta posterior mean of success in the category: (adopt + done + 1) / (adopt + done + dismiss + 2). */
    static double successPrior(List<PlanFeedback> all, Category category) {
        long wins = 0;
        long losses = 0;
        for (PlanFeedback f : all) {
            if (f.getCategory() != category) {
                continue;
            }
            if (f.getEvent() == Event.ADOPTED || f.getEvent() == Event.DONE) {
                wins++;
            } else if (f.getEvent() == Event.DISMISSED) {
                losses++;
            }
        }
        return (wins + 1.0) / (wins + losses + 2.0);
    }

    /**
     * Fatigue: after the k-th dismissal the card is hidden for 3·2^(k−1) days; snoozed or done today hides it
     * until tomorrow (the latest event of today decides, so adopting after a snooze shows it again).
     */
    static boolean hidden(List<PlanFeedback> events, LocalDate today, ZoneId zone) {
        int dismissals = 0;
        LocalDate lastDismissal = null;
        Event latestToday = null;
        for (PlanFeedback f : events) {
            LocalDate on = LocalDate.ofInstant(f.getCreatedAt(), zone);
            if (f.getEvent() == Event.DISMISSED) {
                dismissals++;
                lastDismissal = on;
            }
            if (on.equals(today)) {
                latestToday = f.getEvent();
            }
        }
        if (latestToday == Event.SNOOZED || latestToday == Event.DONE) {
            return true;
        }
        if (dismissals == 0) {
            return false;
        }
        long days = 3L << Math.min(dismissals - 1, 20);
        return today.isBefore(lastDismissal.plusDays(days));
    }

    static Slot slotOf(LocalTime t) {
        if (t.isBefore(MIDDAY_FROM)) {
            return Slot.MORNING;
        }
        if (t.isBefore(MIDDAY_UNTIL)) {
            return Slot.MIDDAY;
        }
        return t.isBefore(EVENING_FROM) ? Slot.ANYTIME : Slot.EVENING;
    }

    /** Whether the slot has not passed yet today; evening lasts until midnight. */
    static boolean slotAhead(Slot slot, LocalTime now) {
        return switch (slot) {
            case MORNING -> now.isBefore(MIDDAY_FROM);
            case MIDDAY -> now.isBefore(MIDDAY_UNTIL);
            case EVENING, ANYTIME -> true;
        };
    }

    private static Card card(Candidate c, double score, List<PlanFeedback> events) {
        BigDecimal high = c.highKg().setScale(2, RoundingMode.HALF_EVEN);
        BigDecimal low = c.highKg().multiply(REBOUND_KEEP).setScale(2, RoundingMode.HALF_EVEN);
        CardStatus status = CardStatus.NEW;
        String ifThen = c.action().ifThen;
        for (PlanFeedback f : events) {
            if (f.getEvent() == Event.ADOPTED) {
                status = CardStatus.ADOPTED;
            } else if (f.getEvent() == Event.DISMISSED) {
                status = CardStatus.NEW;
            }
            if (f.getNote() != null) {
                ifThen = f.getNote();
            }
        }
        return new Card(c.action().name(), c.action().category, c.slot(), c.title(), c.detail(), c.whyNow(),
                new Saving(low, high, c.per()), c.action().effort, ifThen, c.sources(), status,
                BigDecimal.valueOf(score).setScale(2, RoundingMode.HALF_EVEN));
    }

    // ---- candidates (docs/11 section 4) ------------------------------------------------------

    /** One evaluation: the user's recent logs, the factor date and today's grid signal. */
    private final class Ctx {
        private final List<Activity> recent;
        private final List<Activity> year;
        private final String country;
        private final LocalDate on;
        private final ZoneId zone;
        private final GridSignal signal;

        Ctx(List<Activity> recent, List<Activity> year, String country, LocalDate on, ZoneId zone,
                GridSignal signal) {
            this.recent = recent;
            this.year = year;
            this.country = country;
            this.on = on;
            this.zone = zone;
            this.signal = signal;
        }

        Optional<Candidate> candidate(Action a) {
            return switch (a) {
                case COMMUTE_SWAP -> commuteSwap();
                case MEAL_SWAP -> mealSwap();
                case PLANT_DAY -> plantDay();
                case SHIFT_APPLIANCE -> shiftAppliance();
                case EV_CHARGE_WINDOW -> evChargeWindow();
                case TRAIN_NOT_PLANE -> trainNotPlane();
            };
        }

        /** One typical (median-km) car trip: its logged kg minus the same trip by the best public/active mode. */
        private Optional<Candidate> commuteSwap() {
            List<Activity> trips = matching(recent, Category.TRANSPORT, CARS);
            if (trips.isEmpty()) {
                return Optional.empty();
            }
            Activity typical = median(trips, Activity::getQuantity);
            EmissionFactor best = null;
            BigDecimal bestKg = null;
            for (String subtype : PUBLIC_OR_ACTIVE) {
                Optional<EmissionFactor> f = factor(Category.TRANSPORT, subtype);
                if (f.isPresent()) {
                    BigDecimal kg = engine.kgCo2e(f.get(), typical.getQuantity(), 1);
                    if (bestKg == null || kg.compareTo(bestKg) < 0) {
                        best = f.get();
                        bestKg = kg;
                    }
                }
            }
            if (best == null) {
                return Optional.empty();
            }
            BigDecimal saved = typical.getKgCo2e().subtract(bestKg);
            EmissionFactor alt = best;
            String km = typical.getQuantity().stripTrailingZeros().toPlainString();
            List<SourceRef> sources = new ArrayList<>();
            factor(Category.TRANSPORT, typical.getSubtype()).ifPresent(f -> sources.add(source(f)));
            sources.add(source(best));
            return positive(saved).map(s -> new Candidate(Action.COMMUTE_SWAP, Action.COMMUTE_SWAP.slot,
                    "Swap one " + km + " km car trip for " + alt.getLabel().toLowerCase(),
                    "Your typical car trip, recomputed with the " + alt.getLabel().toLowerCase()
                            + " factor. Saves part of today's footprint; the rest of the gap stays.",
                    "You logged " + trips.size() + " car " + plural(trips.size(), "trip") + " in the last "
                            + WINDOW_DAYS + " days.",
                    s, Per.TODAY, true, sources));
        }

        /** One meal: factor(the red meat you log most) − factor(vegetarian meal). */
        private Optional<Candidate> mealSwap() {
            List<Activity> meals = matching(recent, Category.DIET, RED_MEAT);
            if (meals.isEmpty()) {
                return Optional.empty();
            }
            String usual = meals.stream().collect(Collectors.groupingBy(Activity::getSubtype, Collectors.counting()))
                    .entrySet().stream().max(Map.Entry.<String, Long>comparingByValue()
                            .thenComparing(Map.Entry.comparingByKey())).orElseThrow().getKey();
            Optional<EmissionFactor> meat = factor(Category.DIET, usual);
            Optional<EmissionFactor> veg = factor(Category.DIET, "MEAL_VEGETARIAN");
            if (meat.isEmpty() || veg.isEmpty()) {
                return Optional.empty();
            }
            BigDecimal saved = perMeal(meat.get()).subtract(perMeal(veg.get()));
            String what = usual.equals("MEAL_LAMB") ? "lamb" : "beef";
            int n = meals.stream().map(Activity::getQuantity).reduce(BigDecimal.ZERO, BigDecimal::add).intValue();
            return positive(saved).map(s -> new Candidate(Action.MEAL_SWAP, Action.MEAL_SWAP.slot,
                    "Make today's " + what + " meal vegetarian",
                    "One " + what + " meal swapped for a vegetarian one, from the factor table.",
                    "You logged beef or lamb " + n + " " + plural(n, "time") + " in the last " + WINDOW_DAYS
                            + " days.",
                    s, Per.TODAY, true, List.of(source(meat.get()), source(veg.get()))));
        }

        /**
         * One day of meals: (your logged average per meal, or the prior) − vegan meal, times three. The prior is
         * an assumption: the unweighted mean of the non-vegan meal factors in the table.
         */
        private Optional<Candidate> plantDay() {
            if (!matching(recent, Category.DIET, RED_MEAT).isEmpty()) {
                return Optional.empty(); // MEAL_SWAP covers this user
            }
            Optional<EmissionFactor> vegan = factor(Category.DIET, "MEAL_VEGAN");
            if (vegan.isEmpty()) {
                return Optional.empty();
            }
            List<Activity> meals = recent.stream()
                    .filter(a -> a.getCategory() == Category.DIET && "MEAL".equals(a.getUnit())).toList();
            BigDecimal mealCount = meals.stream().map(Activity::getQuantity).reduce(BigDecimal.ZERO, BigDecimal::add);
            boolean personal = mealCount.signum() > 0;
            BigDecimal base;
            if (personal) {
                base = meals.stream().map(Activity::getKgCo2e).reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(mealCount, 6, RoundingMode.HALF_EVEN);
            } else {
                List<BigDecimal> prior = factors.activeFor(Category.DIET, country, on).stream()
                        .filter(f -> "MEAL".equals(f.getUnit()) && !f.getSubtype().equals("MEAL_VEGAN"))
                        .map(EmissionFactor::getKgCo2ePerUnit).toList();
                if (prior.isEmpty()) {
                    return Optional.empty();
                }
                base = prior.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(prior.size()), 6, RoundingMode.HALF_EVEN);
            }
            BigDecimal saved = base.subtract(perMeal(vegan.get())).multiply(MEALS_PER_DAY);
            return positive(saved).map(s -> new Candidate(Action.PLANT_DAY, Action.PLANT_DAY.slot,
                    "Eat plant-based all day today",
                    personal ? "Three vegan meals instead of your logged average meal."
                            : "Three vegan meals instead of an average mixed meal (estimate until you log meals).",
                    personal ? "Based on " + mealCount.stripTrailingZeros().toPlainString() + " "
                            + plural(mealCount.intValue(), "meal") + " logged in the last " + WINDOW_DAYS + " days."
                            : "A low-effort start while there are no meals in your log yet.",
                    s, Per.TODAY, personal, List.of(source(vegan.get()))));
        }

        /**
         * Estimate: 1 kWh per cycle (assumption) × annual electricity factor × the relative drop in non-renewable
         * share between the best window and the day average. The annual factor is used for size only, never
         * for accounting [5], [7].
         */
        private Optional<Candidate> shiftAppliance() {
            Window w = signal.bestWindow();
            Optional<EmissionFactor> grid = factor(Category.ENERGY, "ELECTRICITY");
            if (w == null || signal.points().isEmpty() || grid.isEmpty()) {
                return Optional.empty();
            }
            double avg = signal.points().stream().mapToDouble(pt -> pt.renewableShare().doubleValue()).average()
                    .orElse(0);
            if (avg >= 100) {
                return Optional.empty();
            }
            double gap = (w.avgShare().doubleValue() - avg) / (100 - avg);
            BigDecimal saved = KWH_PER_CYCLE.multiply(grid.get().getKgCo2ePerUnit()).multiply(BigDecimal.valueOf(gap));
            return positive(saved).map(s -> new Candidate(Action.SHIFT_APPLIANCE, windowSlot(w),
                    "Run the washing machine or dishwasher " + windowLabel(w),
                    "Estimate: assumes 1 kWh per cycle and the renewable share of that window. Your footprint "
                            + "still counts the annual grid factor.",
                    "The grid is greenest " + windowLabel(w) + " (" + w.avgShare() + " % renewable).",
                    s, Per.TODAY, false, List.of(source(grid.get()), ENERGY_CHARTS)));
        }

        /** The kg of one typical EV trip (its kWh × the annual factor) × 31 % marginal reduction [6]. */
        private Optional<Candidate> evChargeWindow() {
            Window w = signal.bestWindow();
            List<Activity> trips = matching(recent, Category.TRANSPORT, Set.of("CAR_EV"));
            if (w == null || trips.isEmpty()) {
                return Optional.empty();
            }
            BigDecimal saved = median(trips, Activity::getKgCo2e).getKgCo2e().multiply(EV_SHIFT_REDUCTION);
            return positive(saved).map(s -> new Candidate(Action.EV_CHARGE_WINDOW, windowSlot(w),
                    "Charge the car " + windowLabel(w),
                    "Charging in cleaner hours cut the marginal emission factor by about 31 % on average in a "
                            + "German study; shown for one typical trip's charge.",
                    "You logged " + trips.size() + " electric-car " + plural(trips.size(), "trip") + " in the last "
                            + WINDOW_DAYS + " days.",
                    s, Per.TODAY, true,
                    List.of(new SourceRef("Ben Amor et al., hourly marginal emission factors for Germany", "2024"),
                            ENERGY_CHARTS)));
        }

        /** Per avoided return flight: 1.7 t if long-haul flights were logged, else 0.6 t (medians [1]). */
        private Optional<Candidate> trainNotPlane() {
            List<Activity> flights = matching(year, Category.TRANSPORT, FLIGHTS);
            if (flights.isEmpty()) {
                return Optional.empty();
            }
            boolean longHaul = flights.stream().anyMatch(a -> a.getSubtype().equals("FLIGHT_LONG"));
            return Optional.of(new Candidate(Action.TRAIN_NOT_PLANE, Action.TRAIN_NOT_PLANE.slot,
                    "Plan your next trip without flying",
                    "Avoiding one " + (longHaul ? "long" : "medium") + "-haul return flight; by rail where "
                            + "the route allows it.",
                    "You logged " + flights.size() + " " + plural(flights.size(), "flight") + " in the last "
                            + FLIGHT_WINDOW_DAYS + " days.",
                    longHaul ? LONG_HAUL_FLIGHT_KG : MEDIUM_HAUL_FLIGHT_KG, Per.YEAR, true,
                    List.of(new SourceRef("Ivanova et al., Environ. Res. Lett.", "2020"))));
        }

        private Optional<EmissionFactor> factor(Category category, String subtype) {
            return factors.resolve(category, subtype, country, on);
        }

        private Slot windowSlot(Window w) {
            return slotOf(LocalTime.ofInstant(w.from(), zone));
        }

        private String windowLabel(Window w) {
            return "between " + LocalTime.ofInstant(w.from(), zone) + " and " + LocalTime.ofInstant(w.to(), zone);
        }
    }

    // ---- helpers -----------------------------------------------------------------------------

    private static List<Activity> matching(List<Activity> list, Category category, Set<String> subtypes) {
        return list.stream().filter(a -> a.getCategory() == category && subtypes.contains(a.getSubtype())).toList();
    }

    /** The middle entry by {@code key} (the upper one of two for an even count). */
    private static Activity median(List<Activity> list, Function<Activity, BigDecimal> key) {
        return list.stream().sorted(Comparator.comparing(key)).toList().get(list.size() / 2);
    }

    /** kg for one meal with this factor, through the same engine as logging. */
    private BigDecimal perMeal(EmissionFactor f) {
        return engine.kgCo2e(f, BigDecimal.ONE, 1);
    }

    private static Optional<BigDecimal> positive(BigDecimal kg) {
        return kg.signum() > 0 ? Optional.of(kg) : Optional.empty();
    }

    private static SourceRef source(EmissionFactor f) {
        return new SourceRef(f.getSourceName(), String.valueOf(f.getValidFrom().getYear()));
    }

    private static String plural(long n, String word) {
        return n == 1 ? word : word + "s";
    }
}
