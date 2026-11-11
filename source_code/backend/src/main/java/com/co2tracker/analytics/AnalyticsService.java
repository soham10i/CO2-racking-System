package com.co2tracker.analytics;

import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.analytics.AnalyticsDtos.Benchmarks;
import com.co2tracker.analytics.AnalyticsDtos.CategoryChange;
import com.co2tracker.analytics.AnalyticsDtos.CategoryTotal;
import com.co2tracker.analytics.AnalyticsDtos.Comparison;
import com.co2tracker.analytics.AnalyticsDtos.PeriodTotals;
import com.co2tracker.analytics.AnalyticsDtos.Summary;
import com.co2tracker.analytics.AnalyticsDtos.Trend;
import com.co2tracker.common.ApiException;
import com.co2tracker.emission.Category;
import com.co2tracker.user.UserCalendar;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read side: every figure here comes from the daily_emission projection. Math is in docs/05 section 4. */
@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    static final int MAX_DAY_BUCKETS = 366;
    static final int MAX_RANGE_DAYS = 3 * 366;
    static final int BENCHMARK_WINDOW_DAYS = 365;
    static final int BENCHMARK_MIN_DAYS = 7;

    private final DailyEmissionRepository daily;
    private final ActivityRepository activities;
    private final UserCalendar calendar;
    private final BenchmarkProperties benchmarks;

    public AnalyticsService(DailyEmissionRepository daily, ActivityRepository activities, UserCalendar calendar,
            BenchmarkProperties benchmarks) {
        this.daily = daily;
        this.activities = activities;
        this.calendar = calendar;
        this.benchmarks = benchmarks;
    }

    /** Totals for the day, ISO week (Monday start), month and year containing {@code date} (default: user's today). */
    public Summary summary(UUID userId, LocalDate requested) {
        LocalDate date = requested != null ? requested : calendar.today(userId);
        LocalDate weekStart = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate monthStart = date.withDayOfMonth(1);
        LocalDate prevStart = monthStart.minusMonths(1);
        LocalDate prevEnd = prevStart.withDayOfMonth(Math.min(date.getDayOfMonth(), prevStart.lengthOfMonth()));
        return new Summary(date, daily.total(userId, date, date), daily.total(userId, weekStart, date),
                daily.total(userId, monthStart, date), daily.total(userId, date.withDayOfYear(1), date),
                daily.total(userId, prevStart, prevEnd), totals(daily.byCategory(userId, monthStart, date)));
    }

    public Trend trend(UUID userId, LocalDate from, LocalDate to, Granularity granularity) {
        Granularity g = granularity != null ? granularity : Granularity.DAY;
        LocalDate end = to != null ? to : calendar.today(userId);
        LocalDate start = from != null ? from : defaultStart(end, g);
        long days = checkRange(start, end);
        if (g == Granularity.DAY && days > MAX_DAY_BUCKETS) {
            throw ApiException.unprocessable("range_too_large",
                    "Daily trends cover at most " + MAX_DAY_BUCKETS + " days; use WEEK or MONTH");
        }
        return new Trend(start, end, g, TrendBuilder.build(start, end, g, daily.days(userId, start, end)));
    }

    /** The selected range against the equally long period immediately before it. */
    public Comparison compare(UUID userId, LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : calendar.today(userId);
        LocalDate start = from != null ? from : end.minusDays(29);
        long days = checkRange(start, end);
        LocalDate prevEnd = start.minusDays(1);
        LocalDate prevStart = start.minusDays(days);

        Map<Category, BigDecimal> cur = daily.byCategory(userId, start, end);
        Map<Category, BigDecimal> prev = daily.byCategory(userId, prevStart, prevEnd);
        BigDecimal curTotal = sum(cur);
        BigDecimal prevTotal = sum(prev);
        List<CategoryChange> changes = Arrays.stream(Category.values())
                .map(c -> new CategoryChange(c, cur.get(c), prev.get(c), changePct(cur.get(c), prev.get(c))))
                .toList();
        return new Comparison(new PeriodTotals(start, end, curTotal, totals(cur)),
                new PeriodTotals(prevStart, prevEnd, prevTotal, totals(prev)), changePct(curTotal, prevTotal), changes);
    }

    /** Annualised footprint over the last 365 days (or since the first log), next to published references. */
    public Benchmarks benchmarks(UUID userId) {
        LocalDate today = calendar.today(userId);
        LocalDate windowStart = today.minusDays(BENCHMARK_WINDOW_DAYS - 1);
        LocalDate first = activities.firstDay(userId);
        if (first != null && first.isAfter(windowStart)) {
            windowStart = first;
        }
        int days = first == null ? 0 : (int) ChronoUnit.DAYS.between(windowStart, today) + 1;
        BigDecimal kg = first == null ? BigDecimal.ZERO : daily.total(userId, windowStart, today);
        BigDecimal annualTonnes = days < BENCHMARK_MIN_DAYS ? null
                : kg.multiply(BigDecimal.valueOf(365)).divide(BigDecimal.valueOf(days * 1000L), 2,
                        RoundingMode.HALF_EVEN);
        return new Benchmarks(first == null ? null : windowStart, today, days, kg, annualTonnes, BENCHMARK_MIN_DAYS,
                benchmarks.references());
    }

    // ---- helpers -----------------------------------------------------------------------------

    private static LocalDate defaultStart(LocalDate end, Granularity g) {
        return switch (g) {
            case DAY -> end.minusDays(29);
            case WEEK -> Granularity.WEEK.start(end).minusWeeks(11);
            case MONTH -> end.withDayOfMonth(1).minusMonths(11);
        };
    }

    /** Validates a range and returns its length in days (inclusive). */
    private static long checkRange(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw ApiException.unprocessable("invalid_range", "'from' must not be after 'to'");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_RANGE_DAYS) {
            throw ApiException.unprocessable("range_too_large", "A range covers at most 3 years");
        }
        return days;
    }

    /** (current - previous) / previous x 100, one decimal; null when previous is zero. */
    static BigDecimal changePct(BigDecimal current, BigDecimal previous) {
        if (previous.signum() == 0) {
            return null;
        }
        return current.subtract(previous).multiply(BigDecimal.valueOf(100))
                .divide(previous, 1, RoundingMode.HALF_EVEN);
    }

    private static BigDecimal sum(Map<Category, BigDecimal> m) {
        return m.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static List<CategoryTotal> totals(Map<Category, BigDecimal> m) {
        return m.entrySet().stream().map(e -> new CategoryTotal(e.getKey(), e.getValue())).toList();
    }
}
