package com.co2tracker.emission;

import java.math.BigDecimal;
import java.util.Set;

/** Strategy: the category-specific rules for turning an activity's inputs into kg CO2e. */
public interface CategoryCalculator {

    Set<Category> categories();

    /** Validates category-specific inputs and returns the result in kg CO2e (scale 3). */
    BigDecimal calculate(BigDecimal quantity, EmissionFactor factor, int passengers);
}
