package com.co2tracker.analytics;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/** Trend bucket size. Weeks are ISO weeks starting on Monday. */
public enum Granularity {
    DAY {
        @Override
        LocalDate start(LocalDate d) {
            return d;
        }

        @Override
        LocalDate next(LocalDate start) {
            return start.plusDays(1);
        }
    },
    WEEK {
        @Override
        LocalDate start(LocalDate d) {
            return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        }

        @Override
        LocalDate next(LocalDate start) {
            return start.plusWeeks(1);
        }
    },
    MONTH {
        @Override
        LocalDate start(LocalDate d) {
            return d.withDayOfMonth(1);
        }

        @Override
        LocalDate next(LocalDate start) {
            return start.plusMonths(1);
        }
    };

    /** First day of the bucket containing {@code d}. */
    abstract LocalDate start(LocalDate d);

    /** First day of the following bucket. */
    abstract LocalDate next(LocalDate start);
}
