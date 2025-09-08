package com.twd.SpringSecurityJWT.controller;

import com.twd.SpringSecurityJWT.dto.HouseholdCarbonFootprintDTO;
import com.twd.SpringSecurityJWT.entity.HouseholdCarbonFootprint;
import com.twd.SpringSecurityJWT.service.HouseholdCarbonFootprintService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/calculator/household")
public class HouseholdCarbonFootprintController {

    @Autowired
    private HouseholdCarbonFootprintService service;

    @PostMapping("/add")
    public ResponseEntity<Object> addHouseholdData(@RequestBody HouseholdCarbonFootprintDTO dto) {
        HouseholdCarbonFootprint savedRecord = service.saveHouseholdData(dto);
        return ResponseEntity.ok(savedRecord);
    }

    @PostMapping("/update/{id}")
    public ResponseEntity<Object> updateHouseholdData(@PathVariable Integer id, @RequestBody HouseholdCarbonFootprintDTO dto) {
        HouseholdCarbonFootprint updatedRecord = service.updateHouseholdData(id, dto);
        return ResponseEntity.ok(updatedRecord);
    }


    @PostMapping("/delete/{id}")
    public ResponseEntity<Object> deleteHouseholdData(@PathVariable Integer id) {
        service.deleteById(id);
        return ResponseEntity.ok("Household record deleted successfully for id: " + id);
    }
}
