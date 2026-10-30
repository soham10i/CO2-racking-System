package com.co2tracker.insights;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class DigestJob {

    private static final Logger log = LoggerFactory.getLogger(DigestJob.class);

    private final DigestService digests;
    private final Clock clock;

    public DigestJob(DigestService digests, Clock clock) {
        this.digests = digests;
        this.clock = clock;
    }

    @Scheduled(cron = "0 15 * * * *")
    public void run() {
        int sent = digests.sendDue(clock.instant());
        if (sent > 0) {
            log.info("Sent {} weekly digests", sent);
        }
    }
}
