package com.twd.SpringSecurityJWT;

import com.twd.SpringSecurityJWT.controller.TransportationController;
import com.twd.SpringSecurityJWT.dto.TransportationDetailsDTO;
import com.twd.SpringSecurityJWT.entity.TransportationCO2Tracking;
import com.twd.SpringSecurityJWT.repository.TransportationCO2TrackingRepository;
import com.twd.SpringSecurityJWT.repository.UserRepository;
import com.twd.SpringSecurityJWT.service.TransportationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TransportationController.class)
public class TransportationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransportationService transportationService;

    @MockBean
    private TransportationCO2TrackingRepository trackingRepository;

    @MockBean
    private UserRepository userRepository;

    private TransportationDetailsDTO details;
    private TransportationCO2Tracking tracking;

    @BeforeEach
    void setUp() {
        details = new TransportationDetailsDTO();
        details.setMileage(100);
        details.setCarModel("Model S");
        details.setYear(2020);
        details.setEfficiency(10);
        details.setDistanceKm(100);

        tracking = new TransportationCO2Tracking();
        tracking.setId(1);
        tracking.setMileage(100);
        tracking.setCarModel("Model S");
        tracking.setYear(2020);
        tracking.setEfficiency(10);
        tracking.setDistanceKm(100);
        tracking.setTransportType("Car");
    }

    @Test
    void testCalculateAndSaveCO2() throws Exception {
        when(transportationService.calculateAndSaveTransportationCO2(any(TransportationDetailsDTO.class))).thenReturn(1.0);

        mockMvc.perform(MockMvcRequestBuilders.post("/calculator/transportation/calculate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mileage\":100,\"carModel\":\"Model S\",\"year\":2020,\"efficiency\":10,\"distanceKm\":100}"))
                .andExpect(status().isOk())
                .andExpect(content().string("Total CO2 Footprint = 1.0 metric tons of CO2e."));
    }

    @Test
    void testGetCarDetailsById() throws Exception {
        when(trackingRepository.findById(1)).thenReturn(Optional.of(tracking));

        mockMvc.perform(MockMvcRequestBuilders.get("/calculator/transportation/car/1"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"id\":1,\"mileage\":100,\"carModel\":\"Model S\",\"year\":2020,\"efficiency\":10,\"distanceKm\":100,\"transportType\":\"Car\"}"));
    }

    @Test
    void testUpdateCarDetailsById() throws Exception {
        when(trackingRepository.findById(1)).thenReturn(Optional.of(tracking));
        when(transportationService.calculateCO2(any(TransportationDetailsDTO.class))).thenReturn(1.0);

        mockMvc.perform(MockMvcRequestBuilders.post("/calculator/transportation/update/car/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mileage\":100,\"carModel\":\"Model S\",\"year\":2020,\"efficiency\":10,\"distanceKm\":100}"))
                .andExpect(status().isOk())
                .andExpect(content().string("Car record updated successfully for id: 1. Status: 200"));
    }

    @Test
    void testDeleteCarById() throws Exception {
        when(trackingRepository.findById(1)).thenReturn(Optional.of(tracking));

        mockMvc.perform(MockMvcRequestBuilders.delete("/calculator/transportation/car/delete/1"))
                .andExpect(status().isOk())
                .andExpect(content().string("Car record deleted successfully for id: 1"));
    }
}
