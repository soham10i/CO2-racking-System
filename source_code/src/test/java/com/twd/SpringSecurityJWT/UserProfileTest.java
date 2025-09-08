package com.twd.SpringSecurityJWT;

import com.twd.SpringSecurityJWT.controller.UserProfileController;
import com.twd.SpringSecurityJWT.dto.UserProfileDTO;
import com.twd.SpringSecurityJWT.entity.OurUsers;
import com.twd.SpringSecurityJWT.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserProfileController.class)
public class UserProfileTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserRepository userRepository;

    private OurUsers user;
    private UserProfileDTO userProfileDTO;

    @BeforeEach
    void setUp() {
        user = new OurUsers();
        user.setEmail("test@example.com");
        user.setFirstName("John");
        user.setLastName("Doe");
        user.setAddress("123 Main St");
        user.setPhoneNumber("1234567890");
        user.setRole("USER");

        userProfileDTO = new UserProfileDTO();
        userProfileDTO.setFirstName("John");
        userProfileDTO.setLastName("Doe");
        userProfileDTO.setEmail("test@example.com");
        userProfileDTO.setAddress("123 Main St");
        userProfileDTO.setPhoneNumber("1234567890");
        userProfileDTO.setRole("USER");
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void testGetUserProfile() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(MockMvcRequestBuilders.get("/user/get-profile"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"test@example.com\",\"address\":\"123 Main St\",\"phoneNumber\":\"1234567890\",\"role\":\"USER\"}"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void testUpdateUserProfile() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));

        mockMvc.perform(MockMvcRequestBuilders.post("/user/update-profile")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"test@example.com\",\"address\":\"123 Main St\",\"phoneNumber\":\"1234567890\",\"role\":\"USER\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("User profile updated successfully"));
    }
}
