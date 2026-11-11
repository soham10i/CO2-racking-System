package com.co2tracker.nexus;

import com.co2tracker.activity.Activity;
import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.analytics.AnalyticsDtos.Summary;
import com.co2tracker.analytics.AnalyticsService;
import com.co2tracker.emission.EmissionFactor;
import com.co2tracker.emission.EmissionFactorRepository;
import com.co2tracker.plan.PlanFeedback;
import com.co2tracker.plan.PlanFeedbackRepository;
import org.springframework.data.domain.PageRequest;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The signed-in user's own numbers, written as plain text for the system prompt. Only aggregates and the app's
 * factor table go to the model: no name, email, notes or other personal fields.
 */
@Component
class NexusContext {

    static final int DAYS = 90;

    private final ActivityRepository activities;
    private final AnalyticsService analytics;
    private final EmissionFactorRepository factors;
    private final UserCalendar calendar;
    private final PlanFeedbackRepository feedback;
    private final NexusMessageRepository messages;

    NexusContext(ActivityRepository activities, AnalyticsService analytics, EmissionFactorRepository factors,
            UserCalendar calendar, PlanFeedbackRepository feedback, NexusMessageRepository messages) {
        this.feedback = feedback;
        this.messages = messages;
        this.activities = activities;
        this.analytics = analytics;
        this.factors = factors;
        this.calendar = calendar;
    }

    @Transactional(readOnly = true)
    String describe(UUID userId) {
        UserProfile profile = calendar.profile(userId);
        LocalDate today = calendar.today(profile);
        String region = profile.getCountry() == null ? "" : profile.getCountry();
        StringBuilder out = new StringBuilder();
        out.append("Today is ").append(today).append(". User's country: ")
                .append(region.isEmpty() ? "not set" : region).append(".\n");

        Summary s = analytics.summary(userId, today);
        out.append("Logged totals (kg CO2e): this week ").append(kg(s.week())).append(", this month ")
                .append(kg(s.month())).append(", same span last month ").append(kg(s.previousMonthToDate()))
                .append(", this year ").append(kg(s.year())).append(".\n");

        List<Activity> recent = activities.findByUserIdAndOccurredOnBetween(userId, today.minusDays(DAYS - 1), today);
        Map<String, EmissionFactor> current = currentFactors(today, region);
        if (recent.isEmpty()) {
            out.append("The user has logged no activities in the last ").append(DAYS).append(" days.\n");
        } else {
            BigDecimal total = recent.stream().map(Activity::getKgCo2e).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            out.append("Last ").append(DAYS).append(" days: ").append(recent.size()).append(" entries, ")
                    .append(kg(total)).append(" kg CO2e in total.\nBy category:\n");
            group(recent, a -> a.getCategory().name()).forEach((cat, list) -> out.append("- ").append(cat)
                    .append(": ").append(kg(sum(list))).append(" kg (").append(pct(sum(list), total)).append(")\n"));
            out.append("By activity (largest first):\n");
            group(recent, a -> a.getCategory() + "/" + a.getSubtype()).entrySet().stream().limit(12)
                    .forEach(e -> {
                        Activity first = e.getValue().get(0);
                        EmissionFactor f = current.get(e.getKey());
                        BigDecimal qty = e.getValue().stream().map(Activity::getQuantity).filter(Objects::nonNull)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
                        out.append("- ").append(f != null ? f.getLabel() : first.getSubtype()).append(": ")
                                .append(e.getValue().size()).append("x, ").append(qty.stripTrailingZeros()
                                        .toPlainString()).append(' ').append(first.getUnit()).append(", ")
                                .append(kg(sum(e.getValue()))).append(" kg\n");
                    });
        }

        // What the user did with today's-plan suggestions in the last 60 days: steer towards what they accept.
        java.time.Instant since = today.minusDays(60).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
        Map<String, Map<String, Long>> plan = feedback.findByUserIdOrderByCreatedAtAsc(userId).stream()
                .filter(f -> f.getCreatedAt().isAfter(since))
                .collect(Collectors.groupingBy(PlanFeedback::getActionKey, java.util.TreeMap::new,
                        Collectors.groupingBy(f -> f.getEvent().name(), java.util.TreeMap::new, Collectors.counting())));
        if (!plan.isEmpty()) {
            out.append("Reactions to the app's daily-plan suggestions (last 60 days). Favour what they adopt or ")
                    .append("complete; do not push what they keep dismissing:\n");
            plan.forEach((key, events) -> out.append("- ").append(key).append(": ").append(events).append('\n'));
        }
        List<com.co2tracker.nexus.NexusMessage> disliked = messages.findDisliked(userId, PageRequest.of(0, 3));
        if (!disliked.isEmpty()) {
            out.append("The user marked these earlier answers as not helpful; take a different approach:\n");
            disliked.forEach(m -> {
                String c = m.getContent().replaceAll("\\s+", " ");
                out.append("- \"").append(c, 0, Math.min(c.length(), 160)).append("…\"");
                if (m.getRatingNote() != null) {
                    out.append(" (their note: ").append(m.getRatingNote()).append(')');
                }
                out.append('\n');
            });
        }

        out.append("App emission factors valid TODAY (kg CO2e per unit; source). Use these for advice about future ")
                .append("choices. Past entries were calculated with the factor valid on their own date, and some ")
                .append("factors were revised recently, so do not divide the logged totals by these values:\n");
        current.values().stream().sorted(Comparator.comparing((EmissionFactor f) -> f.getCategory().name())
                .thenComparing(EmissionFactor::getSubtype))
                .forEach(f -> out.append("- ").append(f.getCategory()).append('/').append(f.getSubtype())
                        .append(" ").append(f.getLabel()).append(": ")
                        .append(f.getKgCo2ePerUnit().stripTrailingZeros().toPlainString()).append(" per ")
                        .append(f.getUnit()).append(" (").append(f.getSourceName()).append(")\n"));
        return out.toString();
    }

    /** Region-specific beats global, as in FactorService. */
    private Map<String, EmissionFactor> currentFactors(LocalDate date, String region) {
        Map<String, EmissionFactor> byKey = new LinkedHashMap<>();
        for (EmissionFactor f : factors.findValid(date, region)) {
            String key = f.getCategory() + "/" + f.getSubtype();
            EmissionFactor seen = byKey.get(key);
            if (seen == null || (seen.getRegion() == null && f.getRegion() != null)) {
                byKey.put(key, f);
            }
        }
        return byKey;
    }

    private static Map<String, List<Activity>> group(List<Activity> list,
            java.util.function.Function<Activity, String> key) {
        return list.stream().collect(Collectors.groupingBy(key)).entrySet().stream()
                .sorted((a, b) -> sum(b.getValue()).compareTo(sum(a.getValue())))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    private static BigDecimal sum(List<Activity> list) {
        return list.stream().map(Activity::getKgCo2e).filter(Objects::nonNull).reduce(BigDecimal.ZERO,
                BigDecimal::add);
    }

    private static String kg(BigDecimal v) {
        return v == null ? "0" : v.setScale(1, RoundingMode.HALF_UP).toPlainString();
    }

    private static String pct(BigDecimal part, BigDecimal total) {
        return total.signum() == 0 ? "0%"
                : part.multiply(BigDecimal.valueOf(100)).divide(total, 0, RoundingMode.HALF_UP) + "%";
    }
}
