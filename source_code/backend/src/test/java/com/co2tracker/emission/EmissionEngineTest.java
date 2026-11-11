package com.co2tracker.emission;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class EmissionEngineTest {

    @Test
    void refusesToStartWhenACategoryHasNoCalculator() {
        assertThatThrownBy(() -> new EmissionEngine(List.of(new StandardCalculator())))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("TRANSPORT");
    }

    @Test
    void refusesTwoCalculatorsForOneCategory() {
        assertThatThrownBy(() -> new EmissionEngine(
                List.of(new TransportCalculator(), new StandardCalculator(), new StandardCalculator())))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("Two calculators");
    }
}
