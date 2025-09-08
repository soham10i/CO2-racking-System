package com.twd.SpringSecurityJWT.dto;

import lombok.Data;

@Data
public class HouseholdCarbonFootprintDTO {
    private String email;
    private Integer householdSize;
    private double electricityKwh;
    private double electricityFactor;
    private double naturalGasKwh;
    private double heatingOilLitres;
    private double coalBags;
    private double lpgLitres;
    private double propaneLitres;
    private double woodenPelletsMetricTons;
    private double co2EmissionMetricTons; // Calculated value
}
