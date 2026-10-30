package com.co2tracker.insights;

import com.co2tracker.common.ApiException;
import com.co2tracker.emission.Category;
import com.co2tracker.emission.EmissionEngine;
import com.co2tracker.emission.EmissionFactor;
import com.co2tracker.emission.FactorService;
import com.co2tracker.insights.InsightsDtos.BaselineAnswers;
import com.co2tracker.insights.InsightsDtos.BaselineCategory;
import com.co2tracker.insights.InsightsDtos.BaselineItem;
import com.co2tracker.insights.InsightsDtos.BaselineResponse;
import com.co2tracker.user.ProfileEnums.CarFuel;
import com.co2tracker.user.ProfileEnums.HeatingType;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import com.co2tracker.user.UserProfileRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A first annual estimate from a short questionnaire, using the same factors and engine as logged activities.
 * Everything the answers cannot tell us is an explicit, listed assumption; the math is in docs/05 section 6.
 */
@Service
@Transactional
public class BaselineService {

    static final int WEEKS_PER_YEAR = 52;
    /** Lunch and dinner; breakfast and snacks are not estimated. */
    static final int MAIN_MEALS_PER_WEEK = 14;
    /** Assumed one-way distances for a typical flight; real routes vary widely. */
    static final int SHORT_HAUL_KM = 1000;
    static final int LONG_HAUL_KM = 7000;

    static final List<String> ASSUMPTIONS = List.of(
            "A short-haul return flight is counted as 2 × " + SHORT_HAUL_KM + " km and a long-haul one as 2 × "
                    + LONG_HAUL_KM + " km.",
            "Diet counts " + MAIN_MEALS_PER_WEEK + " main meals a week; meals without meat use the vegetarian "
                    + "(or vegan) meal factor, and other meat is the average of pork, poultry and fish.",
            "Clothing uses the cotton T-shirt factor, so it is a lower bound for heavier items.",
            "General waste is counted as landfilled; where it is incinerated (as in most of Germany) the figure is lower.",
            "Home energy and waste are shared equally by everyone in the household.");

    private final FactorService factors;
    private final EmissionEngine engine;
    private final UserCalendar calendar;
    private final UserProfileRepository profiles;
    private final ObjectMapper json;
    private final Clock clock;

    public BaselineService(FactorService factors, EmissionEngine engine, UserCalendar calendar,
            UserProfileRepository profiles, ObjectMapper json, Clock clock) {
        this.factors = factors;
        this.engine = engine;
        this.calendar = calendar;
        this.profiles = profiles;
        this.json = json;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public BaselineResponse preview(UUID userId, BaselineAnswers a) {
        UserProfile p = calendar.profile(userId);
        return estimate(p, a, calendar.today(p), null);
    }

    @Transactional(readOnly = true)
    public Optional<BaselineResponse> get(UUID userId) {
        UserProfile p = calendar.profile(userId);
        if (p.getBaselineAnswers() == null) {
            return Optional.empty();
        }
        return Optional.of(estimate(p, read(p.getBaselineAnswers()), calendar.today(p), p.getBaselineAt()));
    }

    /** Stores the answers, copies the lifestyle ones into the profile and completes onboarding. */
    public BaselineResponse save(UUID userId, BaselineAnswers a) {
        UserProfile p = calendar.profile(userId);
        p.setBaselineAnswers(write(a));
        p.setBaselineAt(clock.instant());
        p.setHouseholdSize(a.householdSize());
        if (a.heatingType() != null) {
            p.setHeatingType(a.heatingType());
        }
        if (a.carKmPerWeek() > 0 && a.carFuel() != null) {
            p.setCarFuel(a.carFuel());
        }
        p.setOnboardingCompleted(true);
        p.setUpdatedAt(clock.instant());
        profiles.save(p);
        return estimate(p, a, calendar.today(p), p.getBaselineAt());
    }

    /** "Skip for now": the dashboard stops redirecting to onboarding; the baseline can be done later. */
    public void skip(UUID userId) {
        UserProfile p = calendar.profile(userId);
        p.setOnboardingCompleted(true);
        p.setUpdatedAt(clock.instant());
        profiles.save(p);
    }

    // ---- estimate ----------------------------------------------------------------------------

    BaselineResponse estimate(UserProfile p, BaselineAnswers a, LocalDate on, Instant savedAt) {
        Lookup f = new Lookup(p.getCountry(), on);
        BigDecimal household = BigDecimal.valueOf(a.householdSize());
        List<BaselineItem> items = new ArrayList<>();

        // Transport: per person, as typed.
        if (a.carKmPerWeek() > 0) {
            String subtype = carSubtype(a.carFuel());
            items.add(item(f, Category.TRANSPORT, subtype, "Car", weekly(a.carKmPerWeek()),
                    a.carKmPerWeek() + " km a week × " + WEEKS_PER_YEAR));
        }
        if (a.busKmPerWeek() > 0) {
            items.add(item(f, Category.TRANSPORT, "BUS", "Bus", weekly(a.busKmPerWeek()),
                    a.busKmPerWeek() + " km a week × " + WEEKS_PER_YEAR));
        }
        if (a.trainKmPerWeek() > 0) {
            items.add(item(f, Category.TRANSPORT, "TRAIN_REGIONAL", "Train", weekly(a.trainKmPerWeek()),
                    a.trainKmPerWeek() + " km a week × " + WEEKS_PER_YEAR));
        }
        if (a.shortHaulReturnFlightsPerYear() > 0) {
            items.add(item(f, Category.TRANSPORT, "FLIGHT_SHORT", "Short-haul flights",
                    BigDecimal.valueOf(2L * SHORT_HAUL_KM * a.shortHaulReturnFlightsPerYear()),
                    a.shortHaulReturnFlightsPerYear() + " return flights × 2 × " + SHORT_HAUL_KM + " km"));
        }
        if (a.longHaulReturnFlightsPerYear() > 0) {
            items.add(item(f, Category.TRANSPORT, "FLIGHT_LONG", "Long-haul flights",
                    BigDecimal.valueOf(2L * LONG_HAUL_KM * a.longHaulReturnFlightsPerYear()),
                    a.longHaulReturnFlightsPerYear() + " return flights × 2 × " + LONG_HAUL_KM + " km"));
        }

        // Home energy: per household, shared.
        if (a.electricityKwhPerYear() > 0) {
            items.add(shared(item(f, Category.ENERGY, "ELECTRICITY", "Electricity",
                    BigDecimal.valueOf(a.electricityKwhPerYear()), a.electricityKwhPerYear() + " kWh a year"),
                    household));
        }
        if (a.heatingPerYear() > 0 && a.heatingType() != null) {
            String subtype = heatingSubtype(a.heatingType());
            if (subtype != null) {
                String unit = a.heatingType() == HeatingType.HEATING_OIL ? " litres" : " kWh";
                items.add(shared(item(f, Category.ENERGY, subtype, "Heating", BigDecimal.valueOf(a.heatingPerYear()),
                        a.heatingPerYear() + unit + " a year"), household));
            } else {
                items.add(new BaselineItem(Category.ENERGY, "Heating", BigDecimal.ZERO,
                        "Not estimated: no factor for this heating type yet"));
            }
        }

        // Diet: per person.
        int beef = Math.min(a.beefOrLambMealsPerWeek(), MAIN_MEALS_PER_WEEK);
        int otherMeat = Math.min(a.otherMeatMealsPerWeek(), MAIN_MEALS_PER_WEEK - beef);
        int plant = MAIN_MEALS_PER_WEEK - beef - otherMeat;
        if (beef > 0) {
            items.add(item(f, Category.DIET, "MEAL_BEEF", "Beef or lamb meals", weekly(beef),
                    beef + " meals a week × " + WEEKS_PER_YEAR));
        }
        if (otherMeat > 0) {
            BigDecimal perMeal = average(f, "MEAL_PORK", "MEAL_POULTRY", "MEAL_FISH");
            items.add(new BaselineItem(Category.DIET, "Other meat or fish meals",
                    round(perMeal.multiply(weekly(otherMeat))), otherMeat + " meals a week × " + WEEKS_PER_YEAR));
        }
        if (plant > 0) {
            String subtype = a.vegan() ? "MEAL_VEGAN" : "MEAL_VEGETARIAN";
            items.add(item(f, Category.DIET, subtype, a.vegan() ? "Vegan meals" : "Vegetarian meals", weekly(plant),
                    plant + " meals a week × " + WEEKS_PER_YEAR));
        }

        // Shopping: per person.
        if (a.phonesPerYear() > 0) {
            items.add(item(f, Category.SHOPPING, "SMARTPHONE", "Phones", BigDecimal.valueOf(a.phonesPerYear()),
                    a.phonesPerYear() + " a year"));
        }
        if (a.laptopsPerYear() > 0) {
            items.add(item(f, Category.SHOPPING, "LAPTOP", "Laptops", BigDecimal.valueOf(a.laptopsPerYear()),
                    a.laptopsPerYear() + " a year"));
        }
        if (a.clothingItemsPerYear() > 0) {
            items.add(item(f, Category.SHOPPING, "TSHIRT", "Clothing", BigDecimal.valueOf(a.clothingItemsPerYear()),
                    a.clothingItemsPerYear() + " items a year"));
        }

        // Waste: per household, shared.
        if (a.residualWasteKgPerWeek() > 0) {
            items.add(shared(item(f, Category.WASTE, "LANDFILL", "General waste", weekly(a.residualWasteKgPerWeek()),
                    a.residualWasteKgPerWeek() + " kg a week × " + WEEKS_PER_YEAR), household));
        }
        if (a.recyclingKgPerWeek() > 0) {
            items.add(shared(item(f, Category.WASTE, "RECYCLING", "Recycling", weekly(a.recyclingKgPerWeek()),
                    a.recyclingKgPerWeek() + " kg a week × " + WEEKS_PER_YEAR), household));
        }

        Map<Category, BigDecimal> totals = new EnumMap<>(Category.class);
        for (Category c : Category.values()) {
            totals.put(c, BigDecimal.ZERO);
        }
        items.forEach(i -> totals.merge(i.category(), i.annualKg(), BigDecimal::add));
        BigDecimal annual = totals.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        List<BaselineCategory> byCategory = totals.entrySet().stream()
                .map(e -> new BaselineCategory(e.getKey(), round(e.getValue()))).toList();
        return new BaselineResponse(a, round(annual), annual.divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_EVEN),
                byCategory, items, ASSUMPTIONS, on, savedAt);
    }

    // ---- helpers -----------------------------------------------------------------------------

    /** Factors valid on one date for one country; a missing factor is a configuration error, not user error. */
    private final class Lookup {
        private final String country;
        private final LocalDate on;

        Lookup(String country, LocalDate on) {
            this.country = country;
            this.on = on;
        }

        EmissionFactor get(Category c, String subtype) {
            return factors.resolve(c, subtype, country, on).orElseThrow(() -> new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE, "factor_missing", "No emission factor for " + c + "/" + subtype));
        }
    }

    private BaselineItem item(Lookup f, Category c, String subtype, String label, BigDecimal quantity, String basis) {
        EmissionFactor factor = f.get(c, subtype);
        return new BaselineItem(c, label, round(engine.kgCo2e(factor, quantity, 1)),
                basis + " × " + factor.getKgCo2ePerUnit().stripTrailingZeros().toPlainString() + " kg ("
                        + factor.getLabel() + ")");
    }

    private static BaselineItem shared(BaselineItem i, BigDecimal household) {
        if (household.compareTo(BigDecimal.ONE) == 0) {
            return i;
        }
        return new BaselineItem(i.category(), i.label(), round(i.annualKg().divide(household, 3, RoundingMode.HALF_EVEN)),
                i.basis() + " ÷ " + household + " people");
    }

    private BigDecimal average(Lookup f, String... subtypes) {
        BigDecimal sum = BigDecimal.ZERO;
        for (String s : subtypes) {
            sum = sum.add(f.get(Category.DIET, s).getKgCo2ePerUnit());
        }
        return sum.divide(BigDecimal.valueOf(subtypes.length), 6, RoundingMode.HALF_EVEN);
    }

    private static BigDecimal weekly(int perWeek) {
        return BigDecimal.valueOf((long) perWeek * WEEKS_PER_YEAR);
    }

    private static BigDecimal round(BigDecimal kg) {
        return kg.setScale(1, RoundingMode.HALF_EVEN);
    }

    static String carSubtype(CarFuel fuel) {
        if (fuel == null) {
            return "CAR_PETROL";
        }
        return switch (fuel) {
            case DIESEL -> "CAR_DIESEL";
            case HYBRID -> "CAR_HYBRID";
            case ELECTRIC -> "CAR_EV";
            // LPG has no factor of its own yet; petrol is the closest conservative choice.
            case PETROL, LPG -> "CAR_PETROL";
        };
    }

    private static String heatingSubtype(HeatingType type) {
        return switch (type) {
            case NATURAL_GAS -> "NATURAL_GAS";
            case HEATING_OIL -> "HEATING_OIL";
            // Electric resistance heating and heat pumps: the answer is the electricity they use.
            case ELECTRIC, HEAT_PUMP -> "ELECTRICITY";
            case DISTRICT, WOOD, OTHER -> null;
        };
    }

    private BaselineAnswers read(String s) {
        try {
            return json.readValue(s, BaselineAnswers.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored baseline answers are unreadable", e);
        }
    }

    private String write(BaselineAnswers a) {
        try {
            return json.writeValueAsString(a);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
