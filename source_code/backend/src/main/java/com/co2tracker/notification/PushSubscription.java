package com.co2tracker.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A browser's Push API subscription: where to post and the keys to encrypt for (RFC 8291). */
@Entity
@Table(name = "push_subscription")
@Getter
@Setter
@NoArgsConstructor
public class PushSubscription {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 600, unique = true)
    private String endpoint;

    /** The browser's P-256 public key, base64url. */
    @Column(nullable = false, length = 120)
    private String p256dh;

    /** The 16-byte auth secret, base64url. */
    @Column(nullable = false, length = 40)
    private String auth;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
