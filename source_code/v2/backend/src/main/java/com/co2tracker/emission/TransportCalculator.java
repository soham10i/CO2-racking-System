package com.co2tracker.emission;

import java.math.BigDecimal;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Car trips are shared between passengers; public transport factors are already per passenger-km. */
@Component
class TransportCalculator implements CategoryCalculator {

    @Override
    public Set<Category> categories() {
        return Set.of(Category.TRANSPORT);
    }

    @Override
    public BigDecimal calculate(BigDecimal quantity, EmissionFactor factor, int passengers) {
        if (passengers > 1 && !factor.isShareable()) {
            throw StandardCalculator.passengersNotApplicable();
        }
        return EmissionCalculator.kgCo2e(quantity, factor, passengers);
    }
}
