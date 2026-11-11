package com.co2tracker.analytics;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Reference footprints shown next to the user's annualised figure; sourced in docs/05-emission-methodology.md. */
@ConfigurationProperties("app.benchmarks")
public record BenchmarkProperties(List<Reference> references) {

    public BenchmarkProperties {
        references = references == null ? List.of() : List.copyOf(references);
    }

    public record Reference(String key, String label, BigDecimal tonnesPerYear, String source) {
    }
}
