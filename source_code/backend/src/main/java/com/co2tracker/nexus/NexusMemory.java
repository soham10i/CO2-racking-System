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
@Table(name = "nexus_memory")
@Getter
@Setter
@NoArgsConstructor
public class NexusMemory {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 1500)
    private String notes;

    @Column(name = "auto_update", nullable = false)
    private boolean autoUpdate = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
