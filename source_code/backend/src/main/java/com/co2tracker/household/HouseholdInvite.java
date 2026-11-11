package com.co2tracker.household;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A single-use join code; only its SHA-256 is stored, like every other token. */
@Entity
@Table(name = "household_invite")
@Getter
@Setter
@NoArgsConstructor
public class HouseholdInvite {

    @Id
    private UUID id;

    @Column(name = "household_id", nullable = false, updatable = false)
    private UUID householdId;

    @Column(name = "code_hash", nullable = false, unique = true, length = 64, updatable = false)
    private String codeHash;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
