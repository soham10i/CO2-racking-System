package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.auth.MailService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Shared HTTP helpers for API tests: a fresh verified user per test keeps tests independent. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class ApiTestSupport {

    static final String PASSWORD = "correct-horse-battery";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean MailService mail;

    /** Registers, verifies and logs in a fresh user; returns the bearer token. */
    String newUserToken() throws Exception {
        return newUserToken("act-" + UUID.randomUUID() + "@example.com");
    }

    String newUserToken(String email) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD, "displayName", "Alex"))))
                .andExpect(status().isAccepted());
        ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
        verify(mail).sendVerification(eq(email), token.capture());
        mvc.perform(post("/api/v1/auth/verify-email").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", token.getValue())))).andExpect(status().isNoContent());
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asText();
    }

    void setCountry(String token, String country) throws Exception {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("displayName", "Alex");
        profile.put("country", country);
        profile.put("timezone", "UTC");
        profile.put("units", "METRIC");
        profile.put("digestOptIn", false);
        profile.put("onboardingCompleted", true);
        mvc.perform(put("/api/v1/me/profile").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(profile)))
                .andExpect(status().isOk());
    }

    Map<String, Object> activity(String category, String subtype, Object quantity, LocalDate on) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", category);
        m.put("subtype", subtype);
        m.put("quantity", quantity);
        m.put("occurredOn", on.toString());
        return m;
    }

    ResultActions send(String method, String path, String token, Object body) throws Exception {
        var req = switch (method) {
            case "POST" -> post(path);
            case "PUT" -> put(path);
            case "DELETE" -> delete(path);
            default -> get(path);
        };
        if (token != null) {
            req.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return mvc.perform(req);
    }

    JsonNode create(String token, Map<String, Object> body) throws Exception {
        String res = send("POST", "/api/v1/activities", token, body).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(res);
    }

}
