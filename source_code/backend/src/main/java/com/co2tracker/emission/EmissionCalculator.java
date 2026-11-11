package com.co2tracker.emission;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure calculation; the only place where an emission figure is produced. */
public final class EmissionCalculator {

    public static final int SCALE = 3;

    private EmissionCalculator() {
    }

    /** kg CO2e = quantity x factor, shared across passengers where the factor allows it. */
    public static BigDecimal kgCo2e(BigDecimal quantity, EmissionFactor factor, int passengers) {
        BigDecimal kg = quantity.multiply(factor.getKgCo2ePerUnit());
        if (factor.isShareable() && passengers > 1) {
            kg = kg.divide(BigDecimal.valueOf(passengers), SCALE + 3, RoundingMode.HALF_EVEN);
        }
        return kg.setScale(SCALE, RoundingMode.HALF_EVEN);
    }
}
