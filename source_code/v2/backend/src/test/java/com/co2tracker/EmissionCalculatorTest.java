package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;

import com.co2tracker.emission.EmissionCalculator;
import com.co2tracker.emission.EmissionFactor;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class EmissionCalculatorTest {

    private static EmissionFactor factor(String perUnit, boolean shareable) {
        EmissionFactor f = new EmissionFactor();
        ReflectionTestUtils.setField(f, "kgCo2ePerUnit", new BigDecimal(perUnit));
        ReflectionTestUtils.setField(f, "shareable", shareable);
        return f;
    }

    @Test
    void multipliesQuantityByFactor() {
        assertThat(EmissionCalculator.kgCo2e(new BigDecimal("12"), factor("0.17", true), 1))
                .isEqualByComparingTo("2.040");
    }

    @Test
    void sharesShareableFactorsAcrossPassengers() {
        assertThat(EmissionCalculator.kgCo2e(new BigDecimal("12"), factor("0.17", true), 2))
                .isEqualByComparingTo("1.020");
    }

    @Test
    void ignoresPassengersForNonShareableFactors() {
        assertThat(EmissionCalculator.kgCo2e(new BigDecimal("10"), factor("0.10", false), 4))
                .isEqualByComparingTo("1.000");
    }

    @Test
    void roundsHalfEvenToThreeDecimals() {
        // exact ties go to the even neighbour: 0.0125 -> 0.012, 0.0135 -> 0.014
        assertThat(EmissionCalculator.kgCo2e(new BigDecimal("0.125"), factor("0.1", false), 1))
                .isEqualByComparingTo("0.012");
        assertThat(EmissionCalculator.kgCo2e(new BigDecimal("0.135"), factor("0.1", false), 1))
                .isEqualByComparingTo("0.014");
        assertThat(EmissionCalculator.kgCo2e(new BigDecimal("0.005"), factor("1", false), 1))
                .isEqualByComparingTo("0.005");
    }

    @Test
    void zeroFactorGivesZero() {
        assertThat(EmissionCalculator.kgCo2e(new BigDecimal("5"), factor("0", false), 1)).isEqualByComparingTo("0");
    }
}
