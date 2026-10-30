package com.co2tracker.template;

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
import java.time.LocalDate;
import java.util.UUID;

public final class TemplateDtos {

    private TemplateDtos() {
    }

    public record TemplateRequest(
            @NotBlank @Size(max = 60) String name,
            @NotNull Category category,
            @NotBlank @Size(max = 32) @Pattern(regexp = "[A-Z_]+", message = "must be an upper-case code") String subtype,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 11, fraction = 3) BigDecimal quantity,
            @Min(1) @Max(9) Integer passengers,
            @Size(max = 200) String note,
            @NotNull Recurrence recurrence,
            /** First booking date of a recurring template; defaults to today. */
            LocalDate startsOn,
            /** Required on update (optimistic locking); ignored on create. */
            Long version) {
    }

    /** {@code kgCo2e} is what one booking would add today, with the factor valid today. */
    public record TemplateResponse(UUID id, String name, Category category, String subtype, String label,
            BigDecimal quantity, String unit, int passengers, String note, Recurrence recurrence, LocalDate startsOn,
            LocalDate nextRunOn, BigDecimal kgCo2e, long version) {
    }

    public record LogRequest(LocalDate occurredOn) {
    }
}
