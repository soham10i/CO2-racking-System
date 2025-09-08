package com.twd.SpringSecurityJWT;

import com.twd.SpringSecurityJWT.controller.AuthController;
import com.twd.SpringSecurityJWT.dto.ReqRes;
import com.twd.SpringSecurityJWT.service.AuthService;
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

@WebMvcTest(AuthController.class)
public class AuthTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    private ReqRes reqRes;

    @BeforeEach
    void setUp() {
        reqRes = new ReqRes();
        reqRes.setMessage("Success");
    }

    @Test
    void testSignUp() throws Exception {
        when(authService.signUp(any(ReqRes.class))).thenReturn(reqRes);

        mockMvc.perform(MockMvcRequestBuilders.post("/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"testuser\",\"password\":\"testpass\"}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"message\":\"Success\"}"));
    }

    @Test
    void testSignIn() throws Exception {
        when(authService.signIn(any(ReqRes.class))).thenReturn(reqRes);

        mockMvc.perform(MockMvcRequestBuilders.post("/auth/signin")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"testuser\",\"password\":\"testpass\"}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"message\":\"Success\"}"));
    }

    @Test
    void testRefreshToken() throws Exception {
        when(authService.refreshToken(any(ReqRes.class))).thenReturn(reqRes);

        mockMvc.perform(MockMvcRequestBuilders.post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"dummyToken\"}"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"message\":\"Success\"}"));
    }
}
