package com.co2tracker.insights;

import com.co2tracker.emission.Category;
import com.co2tracker.user.ProfileEnums.CarFuel;
import com.co2tracker.user.ProfileEnums.HeatingType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class InsightsDtos {

    private InsightsDtos() {
    }

    // ---- monthly budget ----------------------------------------------------------------------

    /** A null budget resets to the default. */
    public record GoalRequest(
            @DecimalMin("1") @DecimalMax("100000") @Digits(integer = 6, fraction = 1) BigDecimal monthlyBudgetKg) {
    }

    public enum BudgetStatus { ON_TRACK, AT_RISK, OVER }

    /**
     * {@code projectedKg} extrapolates the month-to-date pace linearly to the end of the month:
     * {@code monthToDate / daysElapsed * daysInMonth}.
     */
    public record GoalResponse(BigDecimal monthlyBudgetKg, boolean defaultBudget, String basis, LocalDate monthStart,
            int daysElapsed, int daysInMonth, BigDecimal monthToDateKg, BigDecimal projectedKg, BigDecimal remainingKg,
            BudgetStatus status) {
    }

    // ---- onboarding baseline -----------------------------------------------------------------

    /** Typical-week answers; per-household figures (home energy, waste) are divided by {@code householdSize}. */
    public record BaselineAnswers(
            @Min(1) @Max(20) int householdSize,
            CarFuel carFuel,
            @Min(0) @Max(5000) int carKmPerWeek,
            @Min(0) @Max(5000) int busKmPerWeek,
            @Min(0) @Max(5000) int trainKmPerWeek,
            @Min(0) @Max(100) int shortHaulReturnFlightsPerYear,
            @Min(0) @Max(50) int longHaulReturnFlightsPerYear,
            @Min(0) @Max(100000) int electricityKwhPerYear,
            HeatingType heatingType,
            /** kWh per year, or litres for heating oil. */
            @Min(0) @Max(200000) int heatingPerYear,
            @Min(0) @Max(14) int beefOrLambMealsPerWeek,
            @Min(0) @Max(14) int otherMeatMealsPerWeek,
            boolean vegan,
            @Min(0) @Max(20) int phonesPerYear,
            @Min(0) @Max(20) int laptopsPerYear,
            @Min(0) @Max(500) int clothingItemsPerYear,
            @Min(0) @Max(200) int residualWasteKgPerWeek,
            @Min(0) @Max(200) int recyclingKgPerWeek) {
    }

    public record BaselineItem(Category category, String label, BigDecimal annualKg, String basis) {
    }

    public record BaselineCategory(Category category, BigDecimal annualKg) {
    }

    /** {@code savedAt} is null for a preview that was not stored. */
    public record BaselineResponse(BaselineAnswers answers, BigDecimal annualKg, BigDecimal annualTonnes,
            List<BaselineCategory> byCategory, List<BaselineItem> items, List<String> assumptions,
            LocalDate factorsOn, Instant savedAt) {
    }

    // ---- what-if actions ---------------------------------------------------------------------

    /** A saving computed from the user's own logged activities and the current factors, annualised. */
    public record ReductionAction(String key, Category category, String title, String description,
            BigDecimal annualSavingKg, String basis) {
    }

    /**
     * {@code actions} are open suggestions; adopted ones move to {@code commitments}, dismissed and snoozed ones to
     * {@code hidden} (a snooze ends by itself on {@code snoozedUntil}).
     */
    public record ActionsResponse(int windowDays, LocalDate from, LocalDate to, List<ReductionAction> actions,
            List<Commitment> commitments, List<HiddenAction> hidden) {
    }

    public record DecisionRequest(@NotNull ActionDecision.Status status, @Min(1) @Max(365) Integer snoozeDays) {
    }

    /**
     * An adopted action. {@code realisedAnnualKg} compares the user's logged kg per day in the action's scope
     * since adoption with the same figure over the window before it, annualised; null until a week has passed.
     */
    public record Commitment(String key, Category category, String title, LocalDate adoptedOn, int daysSince,
            BigDecimal expectedAnnualKg, BigDecimal realisedAnnualKg, String basis) {
    }

    public record HiddenAction(String key, Category category, String title, ActionDecision.Status status,
            LocalDate snoozedUntil) {
    }

    /**
     * Electricity two ways (GHG Protocol Scope 2 guidance): {@code locationKg} is what the log booked with the grid
     * average; {@code marketKg} uses the supplier's own factor and is null until the user enters one.
     */
    public record Scope2Response(LocalDate from, LocalDate to, BigDecimal kwh, BigDecimal locationKg,
            BigDecimal locationGPerKwh, BigDecimal supplierGPerKwh, BigDecimal marketKg) {
    }

    public record SupplierRequest(@DecimalMin("0") @DecimalMax("2000") BigDecimal gramsPerKwh) {
    }
}
