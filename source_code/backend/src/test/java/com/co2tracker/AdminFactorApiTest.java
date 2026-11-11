package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = "app.admin-emails=ops@example.com, Root-Admin@example.com")
class AdminFactorApiTest extends ApiTestSupport {

    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @Test
    void onlyConfiguredAdminsReachTheConsole() throws Exception {
        String user = newUserToken();
        send("GET", "/api/v1/admin/factors", user, null).andExpect(status().isForbidden());
        send("GET", "/api/v1/me", user, null).andExpect(jsonPath("$.role").value("USER"));

        String admin = newUserToken("root-admin-" + UUID.randomUUID() + "@example.com");
        send("GET", "/api/v1/admin/factors", admin, null).andExpect(status().isForbidden());

        // Matching is case-insensitive and ignores spaces around the list entries.
        String root = newUserToken("root-admin@example.com");
        send("GET", "/api/v1/me", root, null).andExpect(jsonPath("$.role").value("ADMIN"));
        send("GET", "/api/v1/admin/factors", root, null).andExpect(status().isOk());
    }

    @Test
    void publishingAVersionClosesTheCurrentOne() throws Exception {
        String admin = newUserToken("ops@example.com");
        JsonNode list = json.readTree(send("GET", "/api/v1/admin/factors", admin, null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode current = null;
        for (JsonNode f : list) {
            if (f.get("subtype").asText().equals("ELECTRICITY") && f.get("current").asBoolean() && !f.has("region")) {
                current = f;
            }
        }
        assertThat(current).isNotNull();
        String id = current.get("id").asText();

        Map<String, Object> req = new LinkedHashMap<>();
        req.put("kgCo2ePerUnit", current.get("kgCo2ePerUnit").decimalValue().divide(java.math.BigDecimal.TWO));
        req.put("validFrom", today.plusDays(1).toString());
        req.put("sourceName", "Test grid report 2026 (verify)");
        req.put("sourceUrl", "https://example.org/grid");

        JsonNode preview = json.readTree(send("POST", "/api/v1/admin/factors/" + id + "/preview", admin, req)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(preview.get("changePercent").decimalValue()).isEqualByComparingTo("-50");
        assertThat(preview.get("nextVersion").asInt()).isEqualTo(current.get("version").asInt() + 1);

        req.put("sourceUrl", "http://example.org/grid");
        send("POST", "/api/v1/admin/factors/" + id + "/versions", admin, req).andExpect(status().isUnprocessableEntity());
        req.put("sourceUrl", "https://example.org/grid");

        JsonNode next = json.readTree(send("POST", "/api/v1/admin/factors/" + id + "/versions", admin, req)
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(next.get("current").asBoolean()).isTrue();
        assertThat(next.get("version").asInt()).isEqualTo(current.get("version").asInt() + 1);

        // The old row is closed, so it cannot be superseded a second time.
        send("POST", "/api/v1/admin/factors/" + id + "/versions", admin, req).andExpect(status().isUnprocessableEntity());
        // Today's entries still use the old version; from tomorrow the new one applies.
        String user = newUserToken();
        JsonNode a = create(user, activity("ENERGY", "ELECTRICITY", 10, today));
        assertThat(a.get("factor").get("id").asText()).isEqualTo(id);
    }
}
