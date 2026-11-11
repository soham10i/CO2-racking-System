package com.co2tracker.template;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class RecurrenceTest {

    @Test
    void monthlyKeepsTheStartDayAndClampsShortMonths() {
        LocalDate start = LocalDate.of(2026, 1, 31);
        LocalDate feb = Recurrence.MONTHLY.next(start, start);
        assertThat(feb).isEqualTo(LocalDate.of(2026, 2, 28));
        assertThat(Recurrence.MONTHLY.next(feb, start)).isEqualTo(LocalDate.of(2026, 3, 31));
    }

    @Test
    void weekdaysSkipTheWeekend() {
        LocalDate friday = LocalDate.of(2026, 10, 30);
        assertThat(Recurrence.WEEKDAYS.next(friday, friday)).isEqualTo(LocalDate.of(2026, 11, 2));
        assertThat(Recurrence.WEEKDAYS.first(LocalDate.of(2026, 10, 31))).isEqualTo(LocalDate.of(2026, 11, 2));
    }

    @Test
    void firstOnOrAfterSkipsPastRuns() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        assertThat(Recurrence.WEEKLY.firstOnOrAfter(start, LocalDate.of(2026, 10, 9)))
                .isEqualTo(LocalDate.of(2026, 10, 15));
        assertThat(Recurrence.NONE.first(start)).isNull();
    }
}
