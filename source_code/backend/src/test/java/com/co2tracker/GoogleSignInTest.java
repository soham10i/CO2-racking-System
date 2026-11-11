package com.co2tracker;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.co2tracker.auth.GoogleTokenVerifier;
import com.co2tracker.auth.GoogleTokenVerifier.GoogleIdentity;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;

/** Account handling after Google has vouched for the user (token checks are in GoogleTokenVerifier). */
class GoogleSignInTest extends ApiTestSupport {

    @MockBean GoogleTokenVerifier google;

    private org.springframework.test.web.servlet.ResultActions signIn(String credential) throws Exception {
        return mvc.perform(post("/api/v1/auth/google").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("credential", credential))));
    }

    @Test
    void firstSignInCreatesAnActiveAccountWithoutPassword() throws Exception {
        String email = "g-" + UUID.randomUUID() + "@gmail.com";
        when(google.verify("t1")).thenReturn(new GoogleIdentity("sub-" + email, email, "Robin Green"));

        signIn("t1").andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.profile.displayName").value("Robin Green"));
        // Second sign-in finds the same account by Google id.
        signIn("t1").andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email));
        // There is no password to guess.
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isUnauthorized());
    }

    /** Someone registers the victim's address with their own password but cannot confirm it. */
    @Test
    void linkingAnUnconfirmedAccountRemovesTheSquattersPassword() throws Exception {
        String email = "victim-" + UUID.randomUUID() + "@gmail.com";
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD, "displayName", "X"))))
                .andExpect(status().isAccepted());
        verify(mail).sendVerification(eq(email), anyString());

        when(google.verify("t2")).thenReturn(new GoogleIdentity("sub-" + email, email, "Victim"));
        signIn("t2").andExpect(status().isOk());

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void confirmedPasswordAccountIsLinkedAndKeepsItsPassword() throws Exception {
        String email = "both-" + UUID.randomUUID() + "@gmail.com";
        newUserToken(email);
        when(google.verify("t3")).thenReturn(new GoogleIdentity("sub-" + email, email, "Alex"));
        signIn("t3").andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk());
    }

    @Test
    void aSecondGoogleAccountCannotTakeOverALinkedEmail() throws Exception {
        String email = "linked-" + UUID.randomUUID() + "@gmail.com";
        when(google.verify("t4")).thenReturn(new GoogleIdentity("sub-a-" + email, email, "A"));
        when(google.verify("t5")).thenReturn(new GoogleIdentity("sub-b-" + email, email, "B"));
        signIn("t4").andExpect(status().isOk());
        signIn("t5").andExpect(status().isForbidden());
    }
}
