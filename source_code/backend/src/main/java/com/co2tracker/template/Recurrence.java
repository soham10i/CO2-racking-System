package com.co2tracker.template;

import java.time.DayOfWeek;
import java.time.LocalDate;

/** How often a template books itself. Monthly series keep their start day, clamped to short months. */
public enum Recurrence {
    NONE,
    DAILY,
    WEEKDAYS,
    WEEKLY,
    MONTHLY;

    /** The first date of a series that starts on {@code start}; null for NONE. */
    LocalDate first(LocalDate start) {
        return switch (this) {
            case NONE -> null;
            case WEEKDAYS -> weekday(start);
            default -> start;
        };
    }

    /** The run after {@code prev} in a series that started on {@code start}. */
    LocalDate next(LocalDate prev, LocalDate start) {
        return switch (this) {
            case NONE -> null;
            case DAILY -> prev.plusDays(1);
            case WEEKDAYS -> weekday(prev.plusDays(1));
            case WEEKLY -> prev.plusWeeks(1);
            case MONTHLY -> {
                LocalDate m = prev.plusMonths(1);
                yield m.withDayOfMonth(Math.min(start.getDayOfMonth(), m.lengthOfMonth()));
            }
        };
    }

    /** The first run on or after {@code from}. */
    LocalDate firstOnOrAfter(LocalDate start, LocalDate from) {
        LocalDate d = first(start);
        while (d != null && d.isBefore(from)) {
            d = next(d, start);
        }
        return d;
    }

    private static LocalDate weekday(LocalDate d) {
        while (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY) {
            d = d.plusDays(1);
        }
        return d;
    }
}
