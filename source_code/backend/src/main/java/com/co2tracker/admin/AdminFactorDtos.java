package com.co2tracker.admin;

import com.co2tracker.emission.Category;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class AdminFactorDtos {

    private AdminFactorDtos() {
    }

    public record AdminFactor(UUID id, Category category, String subtype, String label, String unit, String region,
            BigDecimal kgCo2ePerUnit, String sourceName, String sourceUrl, String methodNote, LocalDate validFrom,
            LocalDate validTo, int version, boolean current, Instant createdAt) {
    }

    public record VersionRequest(
            @NotNull @DecimalMin("0") @DecimalMax("100000") BigDecimal kgCo2ePerUnit,
            @NotNull LocalDate validFrom,
            @NotBlank @Size(max = 120) String sourceName,
            @Size(max = 300) @Pattern(regexp = "https://\\S+", message = "must be an https link") String sourceUrl,
            @Size(max = 300) String methodNote) {
    }

    /**
     * What publishing would change. Entries already booked keep their factor; {@code entriesFromValidFrom}
     * counts the ones dated on or after the new validFrom that will therefore differ from new entries.
     */
    public record Preview(BigDecimal currentKgPerUnit, BigDecimal newKgPerUnit, BigDecimal changePercent,
            int nextVersion, LocalDate currentValidTo, long entriesFromValidFrom) {
    }
}
