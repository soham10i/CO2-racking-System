package com.twd.SpringSecurityJWT.dto;

import lombok.Data;

import java.util.List;

@Data
public class TransportationDetailsDTO {
    private String email; // User email
    private String transportType; // Transport type: Flight, Car, Bike

    // Flight-specific fields
    private String from;
    private String to;
    private List<String> via;
    private String flightClass;
    private boolean isRoundTrip;
    private boolean includeRadiativeForcing;

    // Car-specific fields
    private int mileage; // Mileage in km
    private String carModel; // Car model
    private int year; // Manufacturing year
    private double efficiency; // Emission efficiency in g/km

    // Bike-specific fields
    private double engineCapacity; // Engine capacity in cc
    private double bikeMileage; // Mileage in km/l

    private int trips; // Number of trips
    private double distanceKm; // Distance traveled
    public String getViaLocations() {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'getViaLocations'");
    }
    public String getToLocation() {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'getToLocation'");
    }
    public String getFromLocation() {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'getFromLocation'");
    }
}
