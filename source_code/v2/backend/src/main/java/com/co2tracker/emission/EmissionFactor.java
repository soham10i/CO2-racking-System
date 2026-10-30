package com.co2tracker.emission;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Read-only reference data; changing a factor means inserting a new row with a later validFrom. */
@Entity
@Table(name = "emission_factor")
@Getter
@NoArgsConstructor
public class EmissionFactor {

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Category category;

    @Column(nullable = false, length = 32)
    private String subtype;

    @Column(nullable = false, length = 80)
    private String label;

    @Column(nullable = false, length = 16)
    private String unit;

    @Column(name = "kg_co2e_per_unit", nullable = false, precision = 14, scale = 6)
    private BigDecimal kgCo2ePerUnit;

    /** ISO country code this factor applies to; null means global. */
    @Column(length = 16)
    private String region;

    @Column(name = "source_name", nullable = false, length = 120)
    private String sourceName;

    @Column(name = "source_url", length = 300)
    private String sourceUrl;

    /** Whether the result is divided by the number of passengers (car trips). */
    @Column(nullable = false)
    private boolean shareable;

    /** Plausibility ceiling for a single activity entry. */
    @Column(name = "max_quantity", nullable = false, precision = 14, scale = 3)
    private BigDecimal maxQuantity;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @Column(nullable = false)
    private int version;

    /** How the value was derived (assumptions, conversions); shown on the methodology page. */
    @Column(name = "method_note", length = 300)
    private String methodNote;
}
