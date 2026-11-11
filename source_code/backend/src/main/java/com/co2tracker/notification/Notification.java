package com.co2tracker.notification;

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

/** One entry in the in-app notification centre. {@code dedupeKey} makes each alert fire at most once per user. */
@Entity
@Table(name = "notification")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    public enum Kind { BUDGET_AT_RISK, BUDGET_OVER, WEEKLY_DIGEST, TEMPLATE_BOOKED, HOUSEHOLD }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24, updatable = false)
    private Kind kind;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 400)
    private String body;

    /** An in-app path such as "/insights"; never an external URL. */
    @Column(length = 120)
    private String link;

    @Column(name = "dedupe_key", nullable = false, length = 80, updatable = false)
    private String dedupeKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;
}
