package com.co2tracker.insights;

import com.co2tracker.analytics.DailyEmissionRepository;
import com.co2tracker.auth.MailService;
import com.co2tracker.emission.Category;
import com.co2tracker.insights.InsightsDtos.GoalResponse;
import com.co2tracker.user.AppUser;
import com.co2tracker.user.ProfileEnums.UserStatus;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import com.co2tracker.user.UserProfileRepository;
import com.co2tracker.user.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Monday-morning summary of last week for users who opted in. Runs hourly; each user gets it once on their
 * own Monday from {@link #SEND_HOUR} local time, marked by {@code digest_sent_on}.
 */
@Service
@Transactional
public class DigestService {

    static final int SEND_HOUR = 8;

    private final UserProfileRepository profiles;
    private final UserRepository users;
    private final DailyEmissionRepository daily;
    private final GoalService goals;
    private final MailService mail;

    public DigestService(UserProfileRepository profiles, UserRepository users, DailyEmissionRepository daily,
            GoalService goals, MailService mail) {
        this.profiles = profiles;
        this.users = users;
        this.daily = daily;
        this.goals = goals;
        this.mail = mail;
    }

    /** Sends every digest due at {@code now}; returns how many went out. */
    public int sendDue(Instant now) {
        int sent = 0;
        for (UserProfile p : profiles.findByDigestOptInTrue()) {
            ZonedDateTime local = now.atZone(UserCalendar.zoneOf(p));
            LocalDate today = local.toLocalDate();
            boolean due = today.getDayOfWeek() == DayOfWeek.MONDAY && local.getHour() >= SEND_HOUR
                    && (p.getDigestSentOn() == null || p.getDigestSentOn().isBefore(today));
            if (!due) {
                continue;
            }
            Optional<AppUser> user = users.findById(p.getUserId()).filter(u -> u.getStatus() == UserStatus.ACTIVE);
            if (user.isEmpty()) {
                continue;
            }
            mail.sendWeeklyDigest(user.get().getEmail(), "Your CO2 week", text(p, today));
            // Marked even if the relay was down: a missed digest is better than a mail storm on retry.
            p.setDigestSentOn(today);
            profiles.save(p);
            sent++;
        }
        return sent;
    }

    String text(UserProfile p, LocalDate monday) {
        LocalDate from = monday.minusDays(7);
        LocalDate to = monday.minusDays(1);
        BigDecimal week = daily.total(p.getUserId(), from, to);
        BigDecimal before = daily.total(p.getUserId(), from.minusDays(7), from.minusDays(1));

        StringBuilder s = new StringBuilder("Hi ").append(p.getDisplayName()).append(",\n\n");
        s.append("Last week (").append(from).append(" to ").append(to).append(") you logged ")
                .append(kg(week)).append(" kg CO2e");
        if (before.signum() > 0) {
            BigDecimal pct = week.subtract(before).multiply(BigDecimal.valueOf(100))
                    .divide(before, 0, RoundingMode.HALF_EVEN);
            s.append(", ").append(pct.signum() >= 0 ? pct + "% more" : pct.negate() + "% less")
                    .append(" than the week before (").append(kg(before)).append(" kg)");
        }
        s.append(".\n");

        Map<Category, BigDecimal> byCategory = daily.byCategory(p.getUserId(), from, to);
        byCategory.entrySet().stream().filter(e -> e.getValue().signum() > 0)
                .max(Comparator.comparing(Map.Entry::getValue))
                .ifPresent(e -> s.append("Biggest share: ").append(label(e.getKey())).append(", ")
                        .append(kg(e.getValue())).append(" kg.\n"));

        GoalResponse g = goals.status(p, to.getMonth() == monday.getMonth() ? monday : to);
        s.append("\nThis month so far: ").append(kg(g.monthToDateKg())).append(" of ").append(kg(g.monthlyBudgetKg()))
                .append(" kg budget, heading for ").append(kg(g.projectedKg())).append(" kg.");
        if (week.signum() == 0) {
            s.append("\n\nNothing was logged last week. A quick-add template makes it a one-tap habit.");
        }
        return s.toString();
    }

    private static String kg(BigDecimal v) {
        return v.setScale(1, RoundingMode.HALF_EVEN).toPlainString();
    }

    private static String label(Category c) {
        String n = c.name().toLowerCase();
        return Character.toUpperCase(n.charAt(0)) + n.substring(1);
    }
}
