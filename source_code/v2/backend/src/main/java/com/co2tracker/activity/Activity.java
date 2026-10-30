package com.co2tracker.activity;

import com.co2tracker.emission.Category;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "activity")
@Getter
@Setter
@NoArgsConstructor
public class Activity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Category category;

    @Column(nullable = false, length = 32)
    private String subtype;

    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal quantity;

    @Column(nullable = false, length = 16)
    private String unit;

    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @Column(nullable = false)
    private int passengers = 1;

    @Column(length = 200)
    private String note;

    @Column(name = "factor_id", nullable = false)
    private UUID factorId;

    @Column(name = "kg_co2e", nullable = false, precision = 14, scale = 3)
    private BigDecimal kgCo2e;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private Long version;
}
