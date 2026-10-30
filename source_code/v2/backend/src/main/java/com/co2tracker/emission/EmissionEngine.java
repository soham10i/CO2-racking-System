package com.co2tracker.emission;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Dispatches to the calculator registered for a category; refuses to start if any category is unhandled. */
@Service
public class EmissionEngine {

    private final Map<Category, CategoryCalculator> byCategory = new EnumMap<>(Category.class);

    public EmissionEngine(List<CategoryCalculator> calculators) {
        for (CategoryCalculator c : calculators) {
            for (Category category : c.categories()) {
                if (byCategory.putIfAbsent(category, c) != null) {
                    throw new IllegalStateException("Two calculators registered for " + category);
                }
            }
        }
        for (Category category : Category.values()) {
            if (!byCategory.containsKey(category)) {
                throw new IllegalStateException("No calculator registered for " + category);
            }
        }
    }

    public BigDecimal kgCo2e(EmissionFactor factor, BigDecimal quantity, int passengers) {
        return byCategory.get(factor.getCategory()).calculate(quantity, factor, passengers);
    }
}
