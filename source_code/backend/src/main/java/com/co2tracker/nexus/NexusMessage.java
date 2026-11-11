package com.co2tracker.nexus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "nexus_message")
@Getter
@Setter
@NoArgsConstructor
public class NexusMessage {

    @Id
    private UUID id;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(nullable = false, updatable = false, length = 16)
    private String role;

    @Column(nullable = false, updatable = false, length = 8000)
    private String content;

    private Short rating;

    @Column(name = "rating_note", length = 300)
    private String ratingNote;

    @Column(length = 64, updatable = false)
    private String model;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
