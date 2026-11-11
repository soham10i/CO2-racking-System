package com.co2tracker.household;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Keyed by user: a user belongs to at most one household. */
@Entity
@Table(name = "household_member")
@Getter
@Setter
@NoArgsConstructor
public class HouseholdMember {

    public enum Role { OWNER, MEMBER }

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "household_id", nullable = false)
    private UUID householdId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Role role;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;
}
