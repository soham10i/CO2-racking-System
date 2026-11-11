package com.co2tracker.insights;

import com.co2tracker.analytics.DailyEmissionRepository;
import com.co2tracker.auth.MailService;
import com.co2tracker.emission.Category;
import com.co2tracker.insights.InsightsDtos.GoalResponse;
import com.co2tracker.notification.Notification.Kind;
import com.co2tracker.notification.NotificationService;
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
    private final NotificationService notifications;

    public DigestService(UserProfileRepository profiles, UserRepository users, DailyEmissionRepository daily,
            GoalService goals, MailService mail, NotificationService notifications) {
        this.profiles = profiles;
        this.users = users;
        this.daily = daily;
        this.goals = goals;
        this.mail = mail;
        this.notifications = notifications;
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
            String text = text(p, today);
            mail.sendWeeklyDigest(user.get().getEmail(), subject(p), text, p.getLocale());
            // The same summary in the notification centre: the first paragraph after the greeting.
            String[] parts = text.split("\n\n", 3);
            notifications.notify(p.getUserId(), Kind.WEEKLY_DIGEST, "digest-" + today, subject(p),
                    parts.length > 1 ? parts[1].strip() : text, "/insights");
            // Marked even if the relay was down: a missed digest is better than a mail storm on retry.
            p.setDigestSentOn(today);
            profiles.save(p);
            sent++;
        }
        return sent;
    }

    String text(UserProfile p, LocalDate monday) {
        boolean de = "de".equals(p.getLocale());
        LocalDate from = monday.minusDays(7);
        LocalDate to = monday.minusDays(1);
        BigDecimal week = daily.total(p.getUserId(), from, to);
        BigDecimal before = daily.total(p.getUserId(), from.minusDays(7), from.minusDays(1));

        StringBuilder s = new StringBuilder(de ? "Hallo " : "Hi ").append(p.getDisplayName()).append(",\n\n");
        s.append(de ? "Letzte Woche (" : "Last week (").append(from).append(de ? " bis " : " to ").append(to)
                .append(de ? ") hast du " : ") you logged ").append(kg(week, de)).append(" kg CO2e")
                .append(de ? " erfasst" : "");
        if (before.signum() > 0) {
            BigDecimal pct = week.subtract(before).multiply(BigDecimal.valueOf(100))
                    .divide(before, 0, RoundingMode.HALF_EVEN);
            String change = de ? (pct.signum() >= 0 ? pct + " % mehr" : pct.negate() + " % weniger")
                    : (pct.signum() >= 0 ? pct + "% more" : pct.negate() + "% less");
            s.append(", ").append(change).append(de ? " als in der Woche davor (" : " than the week before (")
                    .append(kg(before, de)).append(" kg)");
        }
        s.append(".\n");

        Map<Category, BigDecimal> byCategory = daily.byCategory(p.getUserId(), from, to);
        byCategory.entrySet().stream().filter(e -> e.getValue().signum() > 0)
                .max(Comparator.comparing(Map.Entry::getValue))
                .ifPresent(e -> s.append(de ? "Größter Anteil: " : "Biggest share: ").append(label(e.getKey(), de))
                        .append(", ").append(kg(e.getValue(), de)).append(" kg.\n"));

        GoalResponse g = goals.status(p, to.getMonth() == monday.getMonth() ? monday : to);
        if (de) {
            s.append("\nDieser Monat bisher: ").append(kg(g.monthToDateKg(), true)).append(" von ")
                    .append(kg(g.monthlyBudgetKg(), true)).append(" kg Budget, Hochrechnung ")
                    .append(kg(g.projectedKg(), true)).append(" kg.");
        } else {
            s.append("\nThis month so far: ").append(kg(g.monthToDateKg(), false)).append(" of ")
                    .append(kg(g.monthlyBudgetKg(), false)).append(" kg budget, heading for ")
                    .append(kg(g.projectedKg(), false)).append(" kg.");
        }
        if (week.signum() == 0) {
            s.append(de ? "\n\nLetzte Woche wurde nichts erfasst. Mit einer Vorlage geht es mit einem Tipp."
                    : "\n\nNothing was logged last week. A quick-add template makes it a one-tap habit.");
        }
        return s.toString();
    }

    static String subject(UserProfile p) {
        return "de".equals(p.getLocale()) ? "Deine CO2-Woche" : "Your CO2 week";
    }

    /** One decimal; German uses a decimal comma. */
    private static String kg(BigDecimal v, boolean de) {
        String plain = v.setScale(1, RoundingMode.HALF_EVEN).toPlainString();
        return de ? plain.replace('.', ',') : plain;
    }

    private static String label(Category c, boolean de) {
        return switch (c) {
            case TRANSPORT -> de ? "Mobilität" : "Transport";
            case ENERGY -> de ? "Wohnenergie" : "Home energy";
            case DIET -> de ? "Ernährung" : "Food";
            case SHOPPING -> de ? "Konsum" : "Shopping";
            case WASTE -> de ? "Abfall" : "Waste";
        };
    }
}
