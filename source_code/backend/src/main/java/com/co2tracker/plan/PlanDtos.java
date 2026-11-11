package com.co2tracker.plan;

import com.co2tracker.emission.Category;
import com.co2tracker.grid.GridDtos.GridSignal;
import com.co2tracker.plan.PlanFeedback.Event;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class PlanDtos {

    private PlanDtos() {
    }

    public enum Slot { MORNING, MIDDAY, EVENING, ANYTIME }

    public enum Effort { LOW, MEDIUM, HIGH }

    public enum Per { TODAY, YEAR }

    public enum CardStatus { NEW, ADOPTED, DONE }

    public record PlanResponse(LocalDate date, List<Card> cards, GridSignal grid) {
    }

    public record Card(String key, Category category, Slot slot, String title, String detail, String whyNow,
            Saving saving, Effort effort, String ifThen, List<SourceRef> sources, CardStatus status,
            BigDecimal score) {
    }

    /** {@code highKg} is the computed saving; {@code lowKg} allows for up to 30 % direct rebound. */
    public record Saving(BigDecimal lowKg, BigDecimal highKg, Per per) {
    }

    public record SourceRef(String label, String year) {
    }

    /** {@code ifThen} is checked in the service (at most 200 characters) so it answers 400 like a bad event. */
    public record FeedbackRequest(@NotNull Event event, String ifThen) {
    }
}
