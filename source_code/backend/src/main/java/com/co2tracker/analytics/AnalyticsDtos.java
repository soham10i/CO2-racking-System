package com.co2tracker.analytics;

import com.co2tracker.emission.Category;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class AnalyticsDtos {

    private AnalyticsDtos() {
    }

    public record CategoryTotal(Category category, BigDecimal kgCo2e) {
    }

    public record Summary(LocalDate date, BigDecimal today, BigDecimal week, BigDecimal month, BigDecimal year,
            /** Same span of the previous month (1st .. same day-of-month), for a fair month-to-date delta. */
            BigDecimal previousMonthToDate, List<CategoryTotal> monthByCategory) {
    }

    /** One trend point; {@code start..end} is clipped to the requested range. */
    public record Bucket(LocalDate start, LocalDate end, BigDecimal total, Map<Category, BigDecimal> byCategory) {
    }

    public record Trend(LocalDate from, LocalDate to, Granularity granularity, List<Bucket> buckets) {
    }

    public record PeriodTotals(LocalDate from, LocalDate to, BigDecimal total, List<CategoryTotal> byCategory) {
    }

    /** {@code changePct} is omitted when the previous value is zero (a change from nothing is undefined). */
    public record CategoryChange(Category category, BigDecimal current, BigDecimal previous, BigDecimal changePct) {
    }

    public record Comparison(PeriodTotals current, PeriodTotals previous, BigDecimal changePct,
            List<CategoryChange> categories) {
    }

    public record Benchmarks(LocalDate windowFrom, LocalDate windowTo, int days, BigDecimal windowKgCo2e,
            /** Omitted when fewer than {@code minDays} are covered. */
            BigDecimal annualTonnes, int minDays, List<BenchmarkProperties.Reference> references) {
    }
}
