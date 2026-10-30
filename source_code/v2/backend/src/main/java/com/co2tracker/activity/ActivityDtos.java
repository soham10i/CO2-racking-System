package com.co2tracker.activity;

import com.co2tracker.emission.Category;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ActivityDtos {

    private ActivityDtos() {
    }

    /** The server derives unit, factor and result; none of them is accepted from the client. */
    public record ActivityRequest(
            @NotNull Category category,
            @NotBlank @Size(max = 32) @Pattern(regexp = "[A-Z_]+", message = "must be an upper-case code") String subtype,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 11, fraction = 3) BigDecimal quantity,
            @NotNull LocalDate occurredOn,
            @Min(1) @Max(9) Integer passengers,
            @Size(max = 200) String note,
            /** Required on update (optimistic locking); ignored on create. */
            Long version) {
    }

    public record EstimateRequest(
            @NotNull Category category,
            @NotBlank @Size(max = 32) @Pattern(regexp = "[A-Z_]+", message = "must be an upper-case code") String subtype,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 11, fraction = 3) BigDecimal quantity,
            LocalDate occurredOn,
            @Min(1) @Max(9) Integer passengers) {
    }

    public record FactorRef(UUID id, BigDecimal kgCo2ePerUnit, String unit, String sourceName, String sourceUrl,
            int version) {
    }

    public record EstimateResponse(BigDecimal kgCo2e, String unit, String label, FactorRef factor) {
    }

    public record ActivityResponse(
            UUID id,
            Category category,
            String subtype,
            String label,
            BigDecimal quantity,
            String unit,
            LocalDate occurredOn,
            int passengers,
            String note,
            BigDecimal kgCo2e,
            FactorRef factor,
            Instant createdAt,
            long version) {
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    }

    public record FactorResponse(UUID id, Category category, String subtype, String label, String unit,
            BigDecimal kgCo2ePerUnit, String region, String sourceName, String sourceUrl, String methodNote,
            boolean shareable, BigDecimal maxQuantity, LocalDate validFrom, int version) {
    }
}
