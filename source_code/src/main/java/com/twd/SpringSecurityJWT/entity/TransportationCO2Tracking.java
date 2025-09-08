package com.twd.SpringSecurityJWT.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "transportCO2TrackerData")
public class TransportationCO2Tracking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private Integer userId;

    @Column(nullable = false)
    private String transportType; // Flight, Car, or Bike

    private String fromLocation;
    private String toLocation;

    @Column(columnDefinition = "JSON")
    private String viaLocations;

    private String flightClass; // Economy, Business, First
    private boolean isRoundTrip; // True if round trip
    private boolean includeRadiativeForcing;

    private int mileage; // Car mileage in km
    private String carModel; // Car model
    private int year; // Manufacturing year
    private double efficiency; // Emission efficiency in g/km

    private double engineCapacity; // Engine capacity for bikes in cc
    private double bikeMileage; // Bike mileage in km/l

    private int trips; // Number of trips
    private double distanceKm; // Total distance traveled

    @Column(nullable = false)
    private double co2EmissionMetricTons; // CO2 emissions in metric tons

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
