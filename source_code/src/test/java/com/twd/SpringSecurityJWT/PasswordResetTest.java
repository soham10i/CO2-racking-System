package com.twd.SpringSecurityJWT;

import com.twd.SpringSecurityJWT.controller.PasswordResetController;
import com.twd.SpringSecurityJWT.dto.PasswordResetDTO;
import com.twd.SpringSecurityJWT.dto.PasswordResetRequestDTO;
import com.twd.SpringSecurityJWT.service.PasswordResetService;
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

@WebMvcTest(PasswordResetController.class)
public class PasswordResetTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PasswordResetService passwordResetService;

    private PasswordResetRequestDTO passwordResetRequestDTO;
    private PasswordResetDTO passwordResetDTO;

    @BeforeEach
    void setUp() {
        passwordResetRequestDTO = new PasswordResetRequestDTO();
        passwordResetRequestDTO.setEmail("test@example.com");

        passwordResetDTO = new PasswordResetDTO();
        passwordResetDTO.setToken("dummyToken");
        passwordResetDTO.setNewPassword("newPassword");
    }

    @Test
    void testRequestPasswordReset() throws Exception {
        when(passwordResetService.requestPasswordReset(any(PasswordResetRequestDTO.class))).thenReturn("Reset link sent");

        mockMvc.perform(MockMvcRequestBuilders.post("/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"test@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("Reset link sent"));
    }

    @Test
    void testResetPassword() throws Exception {
        when(passwordResetService.resetPassword(any(PasswordResetDTO.class))).thenReturn("Password reset successful");

        mockMvc.perform(MockMvcRequestBuilders.post("/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"dummyToken\",\"newPassword\":\"newPassword\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("Password reset successful"));
    }
}
