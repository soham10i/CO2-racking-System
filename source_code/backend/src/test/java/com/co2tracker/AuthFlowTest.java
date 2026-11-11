package com.co2tracker;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

import com.co2tracker.auth.MailService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
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
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowTest {

    private static final String PASSWORD = "correct-horse-battery";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean MailService mail;

    private String newEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private MvcResult postJson(String path, Object body, Cookie... cookies) throws Exception {
        var req = post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        if (cookies.length > 0) {
            req.cookie(cookies);
        }
        return mvc.perform(req).andReturn();
    }

    private String register(String email) throws Exception {
        assertThat(postJson("/api/v1/auth/register",
                java.util.Map.of("email", email, "password", PASSWORD, "displayName", "Alex"))
                .getResponse().getStatus()).isEqualTo(202);
        ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
        verify(mail).sendVerification(eq(email), token.capture());
        return token.getValue();
    }

    private MvcResult login(String email, String password) throws Exception {
        return postJson("/api/v1/auth/login", java.util.Map.of("email", email, "password", password));
    }

    private String accessToken(MvcResult login) throws Exception {
        JsonNode n = json.readTree(login.getResponse().getContentAsString());
        return n.get("accessToken").asText();
    }

    private String registerAndVerify(String email) throws Exception {
        String token = register(email);
        assertThat(postJson("/api/v1/auth/verify-email", java.util.Map.of("token", token))
                .getResponse().getStatus()).isEqualTo(204);
        return token;
    }

    @Test
    void fullSessionLifecycleWithRefreshRotationAndReuseDetection() throws Exception {
        String email = newEmail();
        registerAndVerify(email);

        MvcResult login = login(email, PASSWORD);
        assertThat(login.getResponse().getStatus()).isEqualTo(200);
        Cookie refresh1 = login.getResponse().getCookie("refresh_token");
        assertThat(refresh1).isNotNull();
        assertThat(refresh1.isHttpOnly()).isTrue();
        assertThat(refresh1.getPath()).isEqualTo("/api/v1/auth");

        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + accessToken(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.profile.displayName").value("Alex"))
                .andExpect(jsonPath("$.profile.onboardingCompleted").value(false));

        MvcResult rotated = postJson("/api/v1/auth/refresh", java.util.Map.of(), refresh1);
        assertThat(rotated.getResponse().getStatus()).isEqualTo(200);
        Cookie refresh2 = rotated.getResponse().getCookie("refresh_token");
        assertThat(refresh2.getValue()).isNotEqualTo(refresh1.getValue());

        // Replaying the old token is a theft signal: it must fail and kill the newer token too.
        assertThat(postJson("/api/v1/auth/refresh", java.util.Map.of(), refresh1).getResponse().getStatus()).isEqualTo(401);
        assertThat(postJson("/api/v1/auth/refresh", java.util.Map.of(), refresh2).getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void protectedRoutesRequireAuthentication() throws Exception {
        mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer not.a.jwt")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/users")
                .header("Authorization", "Bearer not.a.jwt")).andExpect(status().isUnauthorized());
    }

    @Test
    void regularUserCannotReachAdminRoutes() throws Exception {
        String email = newEmail();
        registerAndVerify(email);
        String at = accessToken(login(email, PASSWORD));
        mvc.perform(get("/api/v1/admin/users").header("Authorization", "Bearer " + at))
                .andExpect(status().isForbidden());
    }

    @Test
    void unverifiedAccountCannotLogInAndWrongPasswordLooksTheSameAsUnknownEmail() throws Exception {
        String email = newEmail();
        register(email);
        assertThat(login(email, PASSWORD).getResponse().getStatus()).isEqualTo(403);

        MvcResult wrong = login(email, "totally-wrong-password");
        MvcResult unknown = login(newEmail(), "totally-wrong-password");
        assertThat(wrong.getResponse().getStatus()).isEqualTo(401);
        assertThat(unknown.getResponse().getStatus()).isEqualTo(401);
        assertThat(wrong.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString());
    }

    @Test
    void registeringTheSameEmailTwiceDoesNotRevealItAndSendsNoSecondMail() throws Exception {
        String email = newEmail();
        register(email);
        assertThat(postJson("/api/v1/auth/register",
                java.util.Map.of("email", email, "password", PASSWORD, "displayName", "Again"))
                .getResponse().getStatus()).isEqualTo(202);
        verify(mail, org.mockito.Mockito.times(1)).sendVerification(eq(email), anyString());
    }

    @Test
    void weakPasswordsAreRejectedWithFieldErrors() throws Exception {
        MvcResult tooShort = postJson("/api/v1/auth/register",
                java.util.Map.of("email", newEmail(), "password", "short", "displayName", "A"));
        assertThat(tooShort.getResponse().getStatus()).isEqualTo(422);
        assertThat(tooShort.getResponse().getContentAsString()).contains("password");

        MvcResult common = postJson("/api/v1/auth/register",
                java.util.Map.of("email", newEmail(), "password", "passwordpassword", "displayName", "A"));
        assertThat(common.getResponse().getStatus()).isEqualTo(422);
    }

    @Test
    void accountLocksAfterRepeatedFailures() throws Exception {
        String email = newEmail();
        registerAndVerify(email);
        for (int i = 0; i < 5; i++) {
            assertThat(login(email, "wrong-wrong-wrong").getResponse().getStatus()).isEqualTo(401);
        }
        assertThat(login(email, PASSWORD).getResponse().getStatus()).isEqualTo(429);
    }

    @Test
    void passwordResetIsUniformAndRevokesSessions() throws Exception {
        assertThat(postJson("/api/v1/auth/forgot-password", java.util.Map.of("email", newEmail()))
                .getResponse().getStatus()).isEqualTo(202);
        verify(mail, never()).sendPasswordReset(anyString(), anyString());

        String email = newEmail();
        registerAndVerify(email);
        Cookie refresh = login(email, PASSWORD).getResponse().getCookie("refresh_token");

        assertThat(postJson("/api/v1/auth/forgot-password", java.util.Map.of("email", email))
                .getResponse().getStatus()).isEqualTo(202);
        ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
        verify(mail).sendPasswordReset(eq(email), token.capture());

        String newPassword = "a-brand-new-passphrase";
        assertThat(postJson("/api/v1/auth/reset-password",
                java.util.Map.of("token", token.getValue(), "newPassword", newPassword))
                .getResponse().getStatus()).isEqualTo(204);
        // Single use
        assertThat(postJson("/api/v1/auth/reset-password",
                java.util.Map.of("token", token.getValue(), "newPassword", newPassword))
                .getResponse().getStatus()).isEqualTo(400);

        assertThat(postJson("/api/v1/auth/refresh", java.util.Map.of(), refresh).getResponse().getStatus()).isEqualTo(401);
        assertThat(login(email, PASSWORD).getResponse().getStatus()).isEqualTo(401);
        assertThat(login(email, newPassword).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void profileCanBeUpdatedValidatedAndAccountDeleted() throws Exception {
        String email = newEmail();
        registerAndVerify(email);
        String at = accessToken(login(email, PASSWORD));

        var profile = new java.util.LinkedHashMap<String, Object>();
        profile.put("displayName", "Alex P");
        profile.put("country", "DE");
        profile.put("region", "BY");
        profile.put("timezone", "Europe/Berlin");
        profile.put("units", "METRIC");
        profile.put("householdSize", 2);
        profile.put("heatingType", "NATURAL_GAS");
        profile.put("dietType", "OMNIVORE");
        profile.put("commuteMode", "CAR");
        profile.put("car", java.util.Map.of("fuel", "PETROL", "gPerKm", 150));
        profile.put("shoppingHabit", "MODERATE");
        profile.put("digestOptIn", true);
        profile.put("onboardingCompleted", true);

        mvc.perform(put("/api/v1/me/profile").header("Authorization", "Bearer " + at)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(profile)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.car.gPerKm").value(150))
                .andExpect(jsonPath("$.profile.onboardingCompleted").value(true));

        profile.put("timezone", "Mars/Olympus");
        mvc.perform(put("/api/v1/me/profile").header("Authorization", "Bearer " + at)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(profile)))
                .andExpect(status().isUnprocessableEntity());

        profile.put("timezone", "Europe/Berlin");
        profile.put("householdSize", 0);
        mvc.perform(put("/api/v1/me/profile").header("Authorization", "Bearer " + at)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(profile)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors[0].field").value("householdSize"));

        mvc.perform(delete("/api/v1/me").header("Authorization", "Bearer " + at)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"nope-nope-nope\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/me").header("Authorization", "Bearer " + at)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isNoContent());
        assertThat(login(email, PASSWORD).getResponse().getStatus()).isEqualTo(401);
    }

    /** The real verifier: anything that is not a Google-signed token for our client id is refused. */
    @Test
    void googleSignInRejectsForgedTokens() throws Exception {
        mvc.perform(get("/api/v1/auth/providers")).andExpect(status().isOk())
                .andExpect(jsonPath("$.googleClientId").value("test-client.apps.googleusercontent.com"));
        mvc.perform(post("/api/v1/auth/google").contentType(MediaType.APPLICATION_JSON)
                .content("{\"credential\":\"eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.\"}"))
                .andExpect(status().isUnauthorized());
    }
}
