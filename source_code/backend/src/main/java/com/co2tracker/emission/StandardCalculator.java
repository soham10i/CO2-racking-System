package com.co2tracker.emission;

import com.co2tracker.common.ApiException;
import java.math.BigDecimal;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Plain quantity x factor for categories where sharing does not apply. */
@Component
class StandardCalculator implements CategoryCalculator {

    @Override
    public Set<Category> categories() {
        return Set.of(Category.ENERGY, Category.DIET, Category.SHOPPING, Category.WASTE);
    }

    @Override
    public BigDecimal calculate(BigDecimal quantity, EmissionFactor factor, int passengers) {
        if (passengers > 1) {
            throw passengersNotApplicable();
        }
        return EmissionCalculator.kgCo2e(quantity, factor, 1);
    }

    static ApiException passengersNotApplicable() {
        return ApiException.unprocessable("passengers_not_applicable", "Passengers only apply to car trips");
    }
}
