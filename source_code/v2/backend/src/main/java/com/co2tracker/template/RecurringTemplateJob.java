package com.co2tracker.template;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Hourly, so every timezone's midnight is picked up within the hour; catch-up is idempotent per run. */
@Component
@ConditionalOnProperty(name = "app.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class RecurringTemplateJob {

    private static final Logger log = LoggerFactory.getLogger(RecurringTemplateJob.class);

    private final TemplateService templates;
    private final Clock clock;

    public RecurringTemplateJob(TemplateService templates, Clock clock) {
        this.templates = templates;
        this.clock = clock;
    }

    @Scheduled(cron = "0 5 * * * *")
    public void run() {
        // UTC+14 is the earliest timezone, so a UTC date one day ahead covers every user's today.
        int booked = 0;
        for (UUID id : templates.dueIds(LocalDate.now(clock).plusDays(1))) {
            try {
                booked += templates.catchUp(id);
            } catch (RuntimeException e) {
                log.warn("Recurring template {} could not be booked: {}", id, e.getMessage());
            }
        }
        if (booked > 0) {
            log.info("Booked {} recurring entries", booked);
        }
    }
}
