package com.co2tracker.activity;

import com.co2tracker.emission.Category;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Domain event: the emission booked on (user, day, category) changed by {@code deltaKg} (negative on removal).
 * Published synchronously inside the activity's transaction, so read models commit or roll back with it.
 */
public record ActivityEmissionChanged(UUID userId, LocalDate day, Category category, BigDecimal deltaKg) {
}
