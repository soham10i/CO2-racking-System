package com.co2tracker.emission;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Resolves the factor that applies to a user's country on a given day: region match beats global. */
@Service
@Transactional(readOnly = true)
public class FactorService {

    private final EmissionFactorRepository factors;

    public FactorService(EmissionFactorRepository factors) {
        this.factors = factors;
    }

    public Optional<EmissionFactor> resolve(Category category, String subtype, String country, LocalDate date) {
        return factors.findValid(date, regionKey(country)).stream()
                .filter(f -> f.getCategory() == category && f.getSubtype().equals(subtype))
                .max(PREFERENCE);
    }

    /** One factor per (category, subtype): the best one for the country on that day. */
    public List<EmissionFactor> activeFor(Category category, String country, LocalDate date) {
        Map<String, EmissionFactor> best = factors.findValid(date, regionKey(country)).stream()
                .filter(f -> category == null || f.getCategory() == category)
                .collect(Collectors.toMap(f -> f.getCategory() + "/" + f.getSubtype(), f -> f,
                        (a, b) -> PREFERENCE.compare(a, b) >= 0 ? a : b));
        return best.values().stream()
                .sorted(Comparator.comparing(EmissionFactor::getCategory).thenComparing(EmissionFactor::getLabel))
                .toList();
    }

    private static final Comparator<EmissionFactor> PREFERENCE = Comparator
            .comparing((EmissionFactor f) -> f.getRegion() != null)
            .thenComparing(EmissionFactor::getValidFrom)
            .thenComparingInt(EmissionFactor::getVersion);

    private static String regionKey(String country) {
        return Objects.requireNonNullElse(country, "");
    }
}
