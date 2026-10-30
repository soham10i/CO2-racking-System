package com.co2tracker.insights;

import com.co2tracker.analytics.BenchmarkProperties;
import com.co2tracker.analytics.DailyEmissionRepository;
import com.co2tracker.insights.InsightsDtos.BudgetStatus;
import com.co2tracker.insights.InsightsDtos.GoalResponse;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import com.co2tracker.user.UserProfileRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The monthly CO2 budget; by default the 2030 1.5 °C lifestyle target spread evenly over 12 months. */
@Service
@Transactional
public class GoalService {

    static final String DEFAULT_TARGET_KEY = "target-2030";

    private final UserCalendar calendar;
    private final UserProfileRepository profiles;
    private final DailyEmissionRepository daily;
    private final BenchmarkProperties benchmarks;
    private final Clock clock;

    public GoalService(UserCalendar calendar, UserProfileRepository profiles, DailyEmissionRepository daily,
            BenchmarkProperties benchmarks, Clock clock) {
        this.calendar = calendar;
        this.profiles = profiles;
        this.daily = daily;
        this.benchmarks = benchmarks;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GoalResponse get(UUID userId) {
        UserProfile p = calendar.profile(userId);
        return status(p, calendar.today(p));
    }

    public GoalResponse set(UUID userId, BigDecimal monthlyBudgetKg) {
        UserProfile p = calendar.profile(userId);
        p.setMonthlyBudgetKg(monthlyBudgetKg == null ? null : monthlyBudgetKg.setScale(1, RoundingMode.HALF_EVEN));
        p.setUpdatedAt(clock.instant());
        profiles.save(p);
        return status(p, calendar.today(p));
    }

    /** Budget status for the month containing {@code today}, counting days up to and including today. */
    GoalResponse status(UserProfile p, LocalDate today) {
        LocalDate monthStart = today.withDayOfMonth(1);
        int elapsed = today.getDayOfMonth();
        int length = today.lengthOfMonth();
        BigDecimal mtd = daily.total(p.getUserId(), monthStart, today);
        BigDecimal projected = mtd.multiply(BigDecimal.valueOf(length))
                .divide(BigDecimal.valueOf(elapsed), 1, RoundingMode.HALF_EVEN);

        boolean isDefault = p.getMonthlyBudgetKg() == null;
        BigDecimal budget = isDefault ? defaultBudgetKg() : p.getMonthlyBudgetKg();
        BudgetStatus status = mtd.compareTo(budget) > 0 ? BudgetStatus.OVER
                : projected.compareTo(budget) > 0 ? BudgetStatus.AT_RISK : BudgetStatus.ON_TRACK;
        String basis = isDefault ? defaultBasis() : "Your own budget";
        return new GoalResponse(budget, isDefault, basis, monthStart, elapsed, length,
                mtd.setScale(1, RoundingMode.HALF_EVEN), projected,
                budget.subtract(mtd).max(BigDecimal.ZERO).setScale(1, RoundingMode.HALF_EVEN), status);
    }

    BigDecimal defaultBudgetKg() {
        return target().tonnesPerYear().multiply(BigDecimal.valueOf(1000))
                .divide(BigDecimal.valueOf(12), 1, RoundingMode.HALF_EVEN);
    }

    private String defaultBasis() {
        BenchmarkProperties.Reference t = target();
        return t.tonnesPerYear().stripTrailingZeros().toPlainString() + " t a year ÷ 12 (" + t.label() + ", "
                + t.source() + ")";
    }

    private BenchmarkProperties.Reference target() {
        return benchmarks.references().stream().filter(r -> DEFAULT_TARGET_KEY.equals(r.key())).findFirst()
                .orElseThrow(() -> new IllegalStateException("app.benchmarks must define " + DEFAULT_TARGET_KEY));
    }
}
