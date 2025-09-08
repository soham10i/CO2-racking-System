package com.twd.SpringSecurityJWT.service;

import com.twd.SpringSecurityJWT.dto.TransportationDetailsDTO;
import com.twd.SpringSecurityJWT.entity.TransportationCO2Tracking;
import com.twd.SpringSecurityJWT.entity.OurUsers;
import com.twd.SpringSecurityJWT.repository.TransportationCO2TrackingRepository;
import com.twd.SpringSecurityJWT.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TransportationService {

    @Autowired
    private TransportationCO2TrackingRepository trackingRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Calculate and save CO2 emissions for transportation.
     */
    public double calculateAndSaveTransportationCO2(TransportationDetailsDTO details) {
        // Fetch user ID from email
        OurUsers user = userRepository.findByEmail(details.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found with email: " + details.getEmail()));

        // Perform CO2 calculation based on transport type
        double co2Emission = calculateCO2(details);

        // Create a new transportation record
        TransportationCO2Tracking record = new TransportationCO2Tracking();
        record.setUserId(user.getId());
        record.setTransportType(details.getTransportType());
        record.setMileage(details.getMileage());
        record.setCarModel(details.getCarModel());
        record.setYear(details.getYear());
        record.setEfficiency(details.getEfficiency());
        record.setDistanceKm(details.getMileage()); // Assuming mileage is equivalent to distance
        record.setCo2EmissionMetricTons(co2Emission);

        // Save record in the database
        trackingRepository.save(record);

        return co2Emission;
    }

    /**
     * Calculate CO2 emissions based on transport type.
     */
    public double calculateCO2(TransportationDetailsDTO details) {
        double co2Emission = 0;

        switch (details.getTransportType().toLowerCase()) {
            case "car":
                // CO2 = (Mileage * Efficiency) / 1000 to convert g to metric tons
                co2Emission = (details.getMileage() * details.getEfficiency()) / 1000;
                break;
            case "flight":
                double classFactor = switch (details.getFlightClass().toLowerCase()) {
                    case "business" -> 0.25;
                    case "first" -> 0.40;
                    default -> 0.15; // Economy
                };

                double co2ForOneTrip = details.getDistanceKm() * classFactor;

                if (details.isIncludeRadiativeForcing()) {
                    co2ForOneTrip *= 1.9; // Apply radiative forcing multiplier
                }

                co2Emission = co2ForOneTrip * (details.isRoundTrip() ? 2 : 1); // Account for round trips
                break;
            case "bike":
                // CO2 = (Distance * Efficiency) / 1000 to convert g to metric tons
                co2Emission = (details.getDistanceKm() * details.getEfficiency()) / 1000;
                break;
            default:
                throw new IllegalArgumentException("Unsupported transport type: " + details.getTransportType());
        }

        return co2Emission;
    }
}
