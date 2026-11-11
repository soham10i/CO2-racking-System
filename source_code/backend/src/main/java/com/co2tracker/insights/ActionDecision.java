package com.co2tracker.insights;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The user's decision on one what-if action: adopted (tracked as a commitment), dismissed or snoozed. */
@Entity
@Table(name = "action_decision")
@Getter
@Setter
@NoArgsConstructor
public class ActionDecision {

    public enum Status { ADOPTED, DISMISSED, SNOOZED }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "action_key", nullable = false, updatable = false, length = 40)
    private String actionKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(name = "decided_on", nullable = false)
    private LocalDate decidedOn;

    @Column(name = "snoozed_until")
    private LocalDate snoozedUntil;

    @Column(name = "expected_annual_kg", precision = 12, scale = 1)
    private BigDecimal expectedAnnualKg;

    @Column(name = "baseline_kg_per_day", precision = 14, scale = 4)
    private BigDecimal baselineKgPerDay;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
