package com.twd.SpringSecurityJWT.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "household_carbon_footprint")
public class HouseholdCarbonFootprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private Integer userId;

    @Column(nullable = false)
    private Integer householdSize;

    @Column(nullable = false)
    private double electricityKwh;

    @Column(nullable = false)
    private double electricityFactor;

    @Column(nullable = false)
    private double naturalGasKwh;

    @Column(nullable = false)
    private double heatingOilLitres;

    @Column(nullable = false)
    private double coalBags;

    @Column(nullable = false)
    private double lpgLitres;

    @Column(nullable = false)
    private double propaneLitres;

    @Column(nullable = false)
    private double woodenPelletsMetricTons;

    @Column(nullable = false)
    private double co2EmissionMetricTons;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}

