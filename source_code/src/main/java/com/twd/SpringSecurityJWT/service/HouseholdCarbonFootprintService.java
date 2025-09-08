package com.twd.SpringSecurityJWT.service;

import com.twd.SpringSecurityJWT.dto.HouseholdCarbonFootprintDTO;
import com.twd.SpringSecurityJWT.entity.HouseholdCarbonFootprint;
import com.twd.SpringSecurityJWT.repository.HouseholdCarbonFootprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
@Service
public class HouseholdCarbonFootprintService {

    @Autowired
    private HouseholdCarbonFootprintRepository repository;

    public double calculateCO2(HouseholdCarbonFootprintDTO dto) {
        double co2Electricity = dto.getElectricityKwh() * dto.getElectricityFactor();
        double co2NaturalGas = dto.getNaturalGasKwh() * 0.184; // Example factor for natural gas
        double co2HeatingOil = dto.getHeatingOilLitres() * 2.68; // Example factor for heating oil
        double co2Coal = dto.getCoalBags() * 0.185; // Example factor for coal bags
        double co2Lpg = dto.getLpgLitres() * 1.51; // Example factor for LPG
        double co2Propane = dto.getPropaneLitres() * 1.53; // Example factor for propane
        double co2WoodenPellets = dto.getWoodenPelletsMetricTons() * 0.135; // Example factor for wood pellets

        return co2Electricity + co2NaturalGas + co2HeatingOil + co2Coal + co2Lpg + co2Propane + co2WoodenPellets;
    }

    public HouseholdCarbonFootprint saveHouseholdData(HouseholdCarbonFootprintDTO dto) {
        HouseholdCarbonFootprint record = new HouseholdCarbonFootprint();
        record.setHouseholdSize(dto.getHouseholdSize());
        record.setElectricityKwh(dto.getElectricityKwh());
        record.setElectricityFactor(dto.getElectricityFactor());
        record.setNaturalGasKwh(dto.getNaturalGasKwh());
        record.setHeatingOilLitres(dto.getHeatingOilLitres());
        record.setCoalBags(dto.getCoalBags());
        record.setLpgLitres(dto.getLpgLitres());
        record.setPropaneLitres(dto.getPropaneLitres());
        record.setWoodenPelletsMetricTons(dto.getWoodenPelletsMetricTons());

        // Calculate and set CO2 emissions
        double co2Emission = calculateCO2(dto);
        record.setCo2EmissionMetricTons(co2Emission); // Ensure this field is set

        return repository.save(record);
    }

    public HouseholdCarbonFootprint updateHouseholdData(Integer id, HouseholdCarbonFootprintDTO dto) {
        // Fetch the existing record
        HouseholdCarbonFootprint existingRecord = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Household record not found for id: " + id));
    
        // Update the fields
        existingRecord.setHouseholdSize(dto.getHouseholdSize());
        existingRecord.setElectricityKwh(dto.getElectricityKwh());
        existingRecord.setElectricityFactor(dto.getElectricityFactor());
        existingRecord.setNaturalGasKwh(dto.getNaturalGasKwh());
        existingRecord.setHeatingOilLitres(dto.getHeatingOilLitres());
        existingRecord.setCoalBags(dto.getCoalBags());
        existingRecord.setLpgLitres(dto.getLpgLitres());
        existingRecord.setPropaneLitres(dto.getPropaneLitres());
        existingRecord.setWoodenPelletsMetricTons(dto.getWoodenPelletsMetricTons());
    
        // Recalculate CO2 emissions
        double co2Emission = calculateCO2(dto);
        existingRecord.setCo2EmissionMetricTons(co2Emission);
    
        // Save the updated entity
        return repository.save(existingRecord);
    }
    

    public void deleteById(Integer id) {
        repository.deleteById(id);
    }
}
