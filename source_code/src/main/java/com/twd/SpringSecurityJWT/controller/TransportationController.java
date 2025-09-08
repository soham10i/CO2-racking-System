package com.twd.SpringSecurityJWT.controller;

import com.twd.SpringSecurityJWT.dto.TransportationDetailsDTO;
import com.twd.SpringSecurityJWT.entity.OurUsers;
import com.twd.SpringSecurityJWT.entity.TransportationCO2Tracking;
import com.twd.SpringSecurityJWT.repository.TransportationCO2TrackingRepository;
import com.twd.SpringSecurityJWT.repository.UserRepository;
import com.twd.SpringSecurityJWT.service.TransportationService;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/calculator/transportation")
public class TransportationController {

    @Autowired
    private TransportationService transportationService;

    @Autowired
    private TransportationCO2TrackingRepository trackingRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/calculate")
    public ResponseEntity<String> calculateAndSaveCO2(@RequestBody TransportationDetailsDTO details) {
        try {
            double co2Emission = transportationService.calculateAndSaveTransportationCO2(details);
            return ResponseEntity.ok("Total CO2 Footprint = " + co2Emission + " metric tons of CO2e.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error: " + e.getMessage() + ". Status: 500");
        }
    }

    /**
     * Retrieve car details by id.
     */
    @GetMapping("/car/{id}")
    public ResponseEntity<Object> getCarDetailsById(@PathVariable Integer id) {
        Optional<TransportationCO2Tracking> carDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Car"));

        if (carDetails.isPresent()) {
            return ResponseEntity.ok(carDetails.get());
        } else {
            return ResponseEntity.status(404).body("Car record not found for id: " + id + ". Status: 404");
        }
    }

    /**
     * Retrieve flight details by id.
     */
    @GetMapping("/flight/{id}")
    public ResponseEntity<Object> getFlightDetailsById(@PathVariable Integer id) {
        Optional<TransportationCO2Tracking> flightDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Flight"));

        if (flightDetails.isPresent()) {
            return ResponseEntity.ok(flightDetails.get());
        } else {
            return ResponseEntity.status(404).body("Flight record not found for id: " + id + ". Status: 404");
        }
    }

    /**
     * Retrieve bike details by id.
     */
    @GetMapping("/bike/{id}")
    public ResponseEntity<Object> getBikeDetailsById(@PathVariable Integer id) {
        Optional<TransportationCO2Tracking> bikeDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Bike"));

        if (bikeDetails.isPresent()) {
            return ResponseEntity.ok(bikeDetails.get());
        } else {
            return ResponseEntity.status(404).body("Bike record not found for id: " + id + ". Status: 404");
        }
    }

    /**
     * Retrieve all transportation data by user_id.
     */
    @GetMapping("/user/data")
    public ResponseEntity<Object> getAllTransportationDataByUserId(@RequestParam Integer userId) {
        // Fetch the user by userId
        OurUsers user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with userId: " + userId));

        // Fetch transportation records for the user
        List<TransportationCO2Tracking> userRecords = trackingRepository.findAll().stream()
                .filter(record -> record.getUserId().equals(user.getId()))
                .collect(Collectors.toList());

        if (userRecords.isEmpty()) {
            return ResponseEntity.status(404).body("No transportation records found for userId: " + userId);
        }

        return ResponseEntity.ok(userRecords);
    }

    /**
     * Retrieve all car transportation data by user_id.
     */
    @GetMapping("/car/user/{userId}")
    public ResponseEntity<Object> getAllCarDataByUserId(@PathVariable Integer userId) {
        // Fetch the user by userId
        OurUsers user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with userId: " + userId));

        // Fetch car transportation records for the user
        List<TransportationCO2Tracking> carRecords = trackingRepository.findAll().stream()
                .filter(record -> record.getUserId().equals(user.getId()) && record.getTransportType().equalsIgnoreCase("Car"))
                .collect(Collectors.toList());

        if (carRecords.isEmpty()) {
            return ResponseEntity.status(404).body("No car transportation records found for userId: " + userId);
        }

        return ResponseEntity.ok(carRecords);
    }

    /**
     * Retrieve all flight transportation data by user_id.
     */
    @GetMapping("/flight/user/{userId}")
    public ResponseEntity<Object> getAllFlightDataByUserId(@PathVariable Integer userId) {
        List<TransportationCO2Tracking> flightRecords = trackingRepository.findAll().stream()
                .filter(record -> record.getUserId().equals(userId)
                        && record.getTransportType().equalsIgnoreCase("Flight"))
                .collect(Collectors.toList());

        if (flightRecords.isEmpty()) {
            return ResponseEntity.status(404).body("No flight transportation records found for user_id: " + userId);
        }

        return ResponseEntity.ok(flightRecords);
    }

    /**
     * Retrieve all bike transportation data by user_id.
     */
    @GetMapping("/bike/user/{userId}")
    public ResponseEntity<Object> getAllBikeDataByUserId(@PathVariable Integer userId) {
        List<TransportationCO2Tracking> bikeRecords = trackingRepository.findAll().stream()
                .filter(record -> record.getUserId().equals(userId)
                        && record.getTransportType().equalsIgnoreCase("Bike"))
                .collect(Collectors.toList());

        if (bikeRecords.isEmpty()) {
            return ResponseEntity.status(404).body("No bike transportation records found for user_id: " + userId);
        }

        return ResponseEntity.ok(bikeRecords);
    }

    /**
     * Update car details by id.
     */
    @PostMapping("/update/car/{id}")
    public ResponseEntity<Object> updateCarDetailsById(@PathVariable Integer id,
            @RequestBody TransportationDetailsDTO updatedDetails) {
        Optional<TransportationCO2Tracking> carDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Car"));

        if (carDetails.isPresent()) {
            TransportationCO2Tracking car = carDetails.get();
            // Update relevant fields
            car.setMileage(updatedDetails.getMileage());
            car.setCarModel(updatedDetails.getCarModel());
            car.setYear(updatedDetails.getYear());
            car.setEfficiency(updatedDetails.getEfficiency());
            car.setDistanceKm(updatedDetails.getMileage()); // Assuming mileage is equivalent to distance

            // Recalculate CO2 emission
            double co2Emission = transportationService.calculateCO2(updatedDetails);
            car.setCo2EmissionMetricTons(co2Emission);

            // Save updated record
            trackingRepository.save(car);
            return ResponseEntity.ok("Car record updated successfully for id: " + id + ". Status: 200");
        } else {
            return ResponseEntity.status(404).body("Car record not found for id: " + id + ". Status: 404");
        }
    }

    /**
     * Update flight details by id.
     */
    @PostMapping("/update/flight/{id}")
    public ResponseEntity<Object> updateFlightDetailsById(@PathVariable Integer id,
            @RequestBody TransportationDetailsDTO updatedDetails) {
        Optional<TransportationCO2Tracking> flightDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Flight"));

        if (flightDetails.isPresent()) {
            TransportationCO2Tracking flight = flightDetails.get();
            // Update relevant fields
            flight.setFromLocation(updatedDetails.getFromLocation());
            flight.setToLocation(updatedDetails.getToLocation());
            flight.setViaLocations(updatedDetails.getViaLocations());
            flight.setFlightClass(updatedDetails.getFlightClass());
            flight.setRoundTrip(updatedDetails.isRoundTrip());
            flight.setIncludeRadiativeForcing(updatedDetails.isIncludeRadiativeForcing());
            flight.setDistanceKm(updatedDetails.getDistanceKm());

            // Recalculate CO2 emission
            double co2Emission = transportationService.calculateCO2(updatedDetails);
            flight.setCo2EmissionMetricTons(co2Emission);

            // Save updated record
            trackingRepository.save(flight);
            return ResponseEntity.ok("Flight record updated successfully for id: " + id + ". Status: 200");
        } else {
            return ResponseEntity.status(404).body("Flight record not found for id: " + id + ". Status: 404");
        }
    }

    /**
     * Update bike details by id.
     */
    @PostMapping("/update/bike/{id}")
    public ResponseEntity<Object> updateBikeDetailsById(@PathVariable Integer id,
            @RequestBody TransportationDetailsDTO updatedDetails) {
        Optional<TransportationCO2Tracking> bikeDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Bike"));

        if (bikeDetails.isPresent()) {
            TransportationCO2Tracking bike = bikeDetails.get();
            // Update relevant fields
            bike.setEngineCapacity(updatedDetails.getEngineCapacity());
            bike.setBikeMileage(updatedDetails.getBikeMileage());
            bike.setDistanceKm(updatedDetails.getDistanceKm());

            // Recalculate CO2 emission
            double co2Emission = transportationService.calculateCO2(updatedDetails);
            bike.setCo2EmissionMetricTons(co2Emission);

            // Save updated record
            trackingRepository.save(bike);
            return ResponseEntity.ok("Bike record updated successfully for id: " + id + ". Status: 200");
        } else {
            return ResponseEntity.status(404).body("Bike record not found for id: " + id + ". Status: 404");
        }
    }

    /**
     * Delete a car entry by id.
     */
    @DeleteMapping("/car/delete/{id}")
    public ResponseEntity<Object> deleteCarById(@PathVariable Integer id) {
        Optional<TransportationCO2Tracking> carDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Car"));

        if (carDetails.isPresent()) {
            trackingRepository.deleteById(id);
            return ResponseEntity.ok("Car record deleted successfully for id: " + id);
        } else {
            return ResponseEntity.status(404).body("Car record not found for id: " + id);
        }
    }

    /**
     * Delete flight entry by id using POST.
     */
    @DeleteMapping("/flight/delete/{id}")
    public ResponseEntity<Object> deleteFlightById(@PathVariable Integer id) {
        Optional<TransportationCO2Tracking> flightDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Flight"));

        if (flightDetails.isPresent()) {
            trackingRepository.deleteById(id);
            return ResponseEntity.ok("Flight record deleted successfully for id: " + id);
        } else {
            return ResponseEntity.status(404).body("Flight record not found for id: " + id);
        }
    }

    /**
     * Delete bike entry by id using POST.
     */
    @DeleteMapping("/bike/delete/{id}")
    public ResponseEntity<Object> deleteBikeById(@PathVariable Integer id) {
        Optional<TransportationCO2Tracking> bikeDetails = trackingRepository.findById(id)
                .filter(record -> record.getTransportType().equalsIgnoreCase("Bike"));

        if (bikeDetails.isPresent()) {
            trackingRepository.deleteById(id);
            return ResponseEntity.ok("Bike record deleted successfully for id: " + id);
        } else {
            return ResponseEntity.status(404).body("Bike record not found for id: " + id);
        }
    }
}
