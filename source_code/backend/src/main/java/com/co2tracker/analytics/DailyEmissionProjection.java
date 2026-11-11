package com.co2tracker.analytics;

import com.co2tracker.activity.ActivityEmissionChanged;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Projects activity changes into daily_emission. Runs synchronously in the publisher's transaction, so the
 * read model can never drift from the activity table: both commit together or not at all.
 */
@Component
class DailyEmissionProjection {

    private final DailyEmissionRepository repo;

    DailyEmissionProjection(DailyEmissionRepository repo) {
        this.repo = repo;
    }

    @EventListener
    void on(ActivityEmissionChanged e) {
        if (e.deltaKg().signum() != 0) {
            repo.applyDelta(e.userId(), e.day(), e.category(), e.deltaKg());
        }
    }
}
