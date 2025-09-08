package com.twd.SpringSecurityJWT;

import com.twd.SpringSecurityJWT.controller.HouseholdCarbonFootprintController;
import com.twd.SpringSecurityJWT.dto.HouseholdCarbonFootprintDTO;
import com.twd.SpringSecurityJWT.entity.HouseholdCarbonFootprint;
import com.twd.SpringSecurityJWT.service.HouseholdCarbonFootprintService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HouseholdCarbonFootprintController.class)
public class HouseholdCarbonFootprintTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private HouseholdCarbonFootprintService service;

    private HouseholdCarbonFootprint record;


    @Test
    void testAddHouseholdData() throws Exception {
        when(service.saveHouseholdData(any(HouseholdCarbonFootprintDTO.class))).thenReturn(record);

        mockMvc.perform(MockMvcRequestBuilders.post("/calculator/household/add")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"electricityUsage\":100,\"waterUsage\":50,\"gasUsage\":30}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"id\":1,\"electricityUsage\":100,\"waterUsage\":50,\"gasUsage\":30}"));
    }

    @Test
    void testUpdateHouseholdData() throws Exception {
        when(service.updateHouseholdData(any(Integer.class), any(HouseholdCarbonFootprintDTO.class))).thenReturn(record);

        mockMvc.perform(MockMvcRequestBuilders.post("/calculator/household/update/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"electricityUsage\":100,\"waterUsage\":50,\"gasUsage\":30}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"id\":1,\"electricityUsage\":100,\"waterUsage\":50,\"gasUsage\":30}"));
    }

    @Test
    void testDeleteHouseholdData() throws Exception {
        mockMvc.perform(MockMvcRequestBuilders.delete("/calculator/household/delete/1"))
                .andExpect(status().isOk())
                .andExpect(content().string("Household record deleted successfully for id: 1"));
    }
}
