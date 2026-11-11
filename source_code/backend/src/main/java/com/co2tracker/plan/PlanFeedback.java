package com.co2tracker.plan;

import com.co2tracker.emission.Category;
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

/** One reaction to a plan card. Append-only: the ranking reads the whole history (docs/11 section 5). */
@Entity
@Table(name = "plan_feedback")
@Getter
@Setter
@NoArgsConstructor
public class PlanFeedback {

    public enum Event { ADOPTED, DONE, SNOOZED, DISMISSED }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "action_key", nullable = false, updatable = false, length = 40)
    private String actionKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 16)
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 16)
    private Event event;

    @Column(length = 200, updatable = false)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
