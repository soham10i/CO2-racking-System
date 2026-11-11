package com.co2tracker.insights;

import com.co2tracker.activity.ActivityEmissionChanged;
import com.co2tracker.insights.InsightsDtos.BudgetStatus;
import com.co2tracker.insights.InsightsDtos.GoalResponse;
import com.co2tracker.notification.Notification.Kind;
import com.co2tracker.notification.NotificationService;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Raises the monthly-budget alerts after an activity commits: "at risk" once the pace projects past the budget
 * (from day {@link #MIN_DAYS_FOR_PROJECTION}, before that one big entry would always trigger it), "over" once the
 * month-to-date total passes it. Each fires at most once per month.
 */
@Component
class BudgetAlertListener {

    static final int MIN_DAYS_FOR_PROJECTION = 7;
    private static final Logger log = LoggerFactory.getLogger(BudgetAlertListener.class);

    private final GoalService goals;
    private final UserCalendar calendar;
    private final NotificationService notifications;

    BudgetAlertListener(GoalService goals, UserCalendar calendar, NotificationService notifications) {
        this.goals = goals;
        this.calendar = calendar;
        this.notifications = notifications;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void on(ActivityEmissionChanged e) {
        if (e.deltaKg().signum() <= 0) {
            return;
        }
        try {
            UserProfile p = calendar.profile(e.userId());
            LocalDate today = calendar.today(p);
            if (!p.isNotifyBudget() || !YearMonth.from(e.day()).equals(YearMonth.from(today))) {
                return;
            }
            GoalResponse g = goals.status(p, today);
            boolean de = "de".equals(p.getLocale());
            String month = YearMonth.from(today).toString();
            if (g.status() == BudgetStatus.OVER) {
                notifications.notify(p.getUserId(), Kind.BUDGET_OVER, "budget-over-" + month,
                        de ? "Monatsbudget überschritten" : "Monthly budget passed",
                        de ? "Bisher " + kg(g.monthToDateKg(), true) + " von " + kg(g.monthlyBudgetKg(), true)
                                + " kg CO2e diesen Monat."
                                : kg(g.monthToDateKg(), false) + " of " + kg(g.monthlyBudgetKg(), false)
                                        + " kg CO2e so far this month.",
                        "/insights");
            } else if (g.status() == BudgetStatus.AT_RISK && g.daysElapsed() >= MIN_DAYS_FOR_PROJECTION) {
                notifications.notify(p.getUserId(), Kind.BUDGET_AT_RISK, "budget-at-risk-" + month,
                        de ? "Budget in Gefahr" : "Budget at risk",
                        de ? "Bei diesem Tempo landest du bei " + kg(g.projectedKg(), true) + " von "
                                + kg(g.monthlyBudgetKg(), true) + " kg."
                                : "At this pace the month ends at " + kg(g.projectedKg(), false) + " of "
                                        + kg(g.monthlyBudgetKg(), false) + " kg.",
                        "/insights");
            }
        } catch (RuntimeException ex) {
            // An alert must never surface as an error on the request that logged the activity.
            log.warn("Budget alert failed for {}: {}", e.userId(), ex.toString());
        }
    }

    private static String kg(BigDecimal v, boolean de) {
        String plain = v.setScale(1, RoundingMode.HALF_EVEN).toPlainString();
        return de ? plain.replace('.', ',') : plain;
    }
}
