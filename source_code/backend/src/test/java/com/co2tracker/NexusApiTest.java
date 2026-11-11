package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.co2tracker.nexus.NexusClient;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.mock.mockito.MockBean;

/** Nexus: proxy, stored chats, ratings and adaptive memory. The Hermes agent is always mocked. */
class NexusApiTest extends ApiTestSupport {

    @MockBean NexusClient client;

    @BeforeEach
    void setUp() throws Exception {
        doReturn(true).when(client).enabled();
        // Memory refresh calls get a distinct answer so they are easy to tell apart.
        doReturn(new NexusClient.Reply("Take the train (UBA).", "mercury-3")).when(client).complete(any());
        doReturn(new NexusClient.Reply("- Has no car\n- Wants to cut flights", "mercury-3")).when(client)
                .complete(argThat(t -> t != null && !t.isEmpty() && t.get(0).content().startsWith("You maintain")));
    }

    private JsonNode ask(String token, String conversationId, String text) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("message", text);
        if (conversationId != null) {
            body.put("conversationId", conversationId);
        }
        return json.readTree(send("POST", "/api/v1/nexus/chat", token, body).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    @SuppressWarnings("unchecked")
    private List<NexusClient.Turn> lastChatTurns() throws Exception {
        ArgumentCaptor<List<NexusClient.Turn>> turns = ArgumentCaptor.forClass(List.class);
        verify(client, atLeastOnce()).complete(turns.capture());
        return turns.getAllValues().stream().filter(t -> t.get(0).content().startsWith("You are Nexus"))
                .reduce((a, b) -> b).orElseThrow();
    }

    @Test
    void storesTheChatAndSendsHistoryWithUserData() throws Exception {
        String token = newUserToken();
        setCountry(token, "DE");
        create(token, activity("DIET", "MEAL_BEEF", 2, LocalDate.now(ZoneOffset.UTC)));
        JsonNode first = ask(token, null, "What is my biggest source?");
        String conv = first.get("conversationId").asText();
        assertThat(first.at("/reply/content").asText()).isEqualTo("Take the train (UBA).");
        ask(token, conv, "And second?");

        List<NexusClient.Turn> turns = lastChatTurns();
        String system = turns.get(0).content();
        assertThat(system).contains("User's country: DE").contains("DIET: 3.7 kg (100%)")
                .contains("Meal with beef: 1x, 2 MEAL").contains("TRANSPORT/TRAIN_LONG").doesNotContain("@");
        assertThat(turns).extracting(NexusClient.Turn::content)
                .containsSubsequence("What is my biggest source?", "Take the train (UBA).", "And second?");

        send("GET", "/api/v1/nexus/conversations", token, null).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("What is my biggest source?"));
        send("GET", "/api/v1/nexus/conversations/" + conv, token, null)
                .andExpect(jsonPath("$.messages.length()").value(4));
        // Another user can neither read nor continue it.
        String other = newUserToken();
        send("GET", "/api/v1/nexus/conversations/" + conv, other, null).andExpect(status().isNotFound());
        send("POST", "/api/v1/nexus/chat", other, Map.of("conversationId", conv, "message", "hi"))
                .andExpect(status().isNotFound());
        send("DELETE", "/api/v1/nexus/conversations/" + conv, token, null).andExpect(status().isNoContent());
        send("GET", "/api/v1/nexus/conversations", token, null).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void ratingsAreOwnedAndDislikedAnswersSteerLaterPrompts() throws Exception {
        String token = newUserToken();
        JsonNode r = ask(token, null, "Tips?");
        String answer = r.at("/reply/id").asText();
        send("POST", "/api/v1/nexus/messages/" + r.at("/userMessage/id").asText() + "/rating", token,
                Map.of("rating", 1)).andExpect(status().isUnprocessableEntity());
        send("POST", "/api/v1/nexus/messages/" + answer + "/rating", newUserToken(), Map.of("rating", -1))
                .andExpect(status().isNotFound());
        send("POST", "/api/v1/nexus/messages/" + answer + "/rating", token,
                Map.of("rating", -1, "note", "I have no car")).andExpect(status().isNoContent());
        ask(token, null, "Other tips?");
        assertThat(lastChatTurns().get(0).content()).contains("marked these earlier answers as not helpful")
                .contains("their note: I have no car");
    }

    @Test
    void memoryIsLearnedEveryThirdQuestionAndUserControlled() throws Exception {
        String token = newUserToken();
        JsonNode first = ask(token, null, "I sold my car.");
        String conv = first.get("conversationId").asText();
        ask(token, conv, "I fly twice a year.");
        send("GET", "/api/v1/nexus/memory", token, null).andExpect(jsonPath("$.notes").value(""));
        ask(token, conv, "What next?");
        send("GET", "/api/v1/nexus/memory", token, null)
                .andExpect(jsonPath("$.notes").value("- Has no car\n- Wants to cut flights"));
        ask(token, conv, "More?");
        assertThat(lastChatTurns().get(0).content()).contains("What you remember about this user")
                .contains("Has no car");

        send("PUT", "/api/v1/nexus/memory", token, Map.of("notes", "- Vegetarian", "autoUpdate", false))
                .andExpect(jsonPath("$.autoUpdate").value(false));
        ask(token, conv, "Q5");
        ask(token, conv, "Q6");
        send("GET", "/api/v1/nexus/memory", token, null).andExpect(jsonPath("$.notes").value("- Vegetarian"));
        send("DELETE", "/api/v1/nexus/memory", token, null).andExpect(status().isNoContent());
        send("GET", "/api/v1/nexus/memory", token, null).andExpect(jsonPath("$.notes").value(""));
    }

    @Test
    void validationAuthUpstreamAndDisabled() throws Exception {
        send("POST", "/api/v1/nexus/chat", null, Map.of("message", "hi")).andExpect(status().isUnauthorized());
        String token = newUserToken();
        send("POST", "/api/v1/nexus/chat", token, Map.of("message", "x".repeat(2001)))
                .andExpect(status().isUnprocessableEntity());
        doThrow(new IOException("down")).when(client).complete(any());
        send("POST", "/api/v1/nexus/chat", token, Map.of("message", "hi")).andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("nexus_upstream"));
        doReturn(false).when(client).enabled();
        send("GET", "/api/v1/nexus/status", token, null).andExpect(jsonPath("$.enabled").value(false));
        send("POST", "/api/v1/nexus/chat", token, Map.of("message", "hi")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void rateLimitsPerUser() throws Exception {
        String token = newUserToken();
        for (int i = 0; i < 10; i++) {
            send("POST", "/api/v1/nexus/chat", token, Map.of("message", "q" + i)).andExpect(status().isOk());
        }
        send("POST", "/api/v1/nexus/chat", token, Map.of("message", "one more")).andExpect(status().isTooManyRequests());
    }
}
