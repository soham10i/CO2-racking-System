package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class Phase6ApiTest extends ApiTestSupport {

    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    private JsonNode body(org.springframework.test.web.servlet.ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    // ---- 14 locale -------------------------------------------------------------------------------

    @Test
    void localeIsStoredAndValidated() throws Exception {
        String token = newUserToken();
        send("GET", "/api/v1/me", token, null).andExpect(jsonPath("$.profile.locale").value("en"));
        mvc.perform(patch("/api/v1/me/preferences").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"locale\":\"de\"}")).andExpect(status().isOk());
        send("GET", "/api/v1/me", token, null).andExpect(jsonPath("$.profile.locale").value("de"));
        mvc.perform(patch("/api/v1/me/preferences").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"locale\":\"fr\"}"))
                .andExpect(status().isUnprocessableEntity());
    }

    // ---- 15 notifications ------------------------------------------------------------------------

    @Test
    void passingTheBudgetNotifiesOncePerMonth() throws Exception {
        String token = newUserToken();
        send("PUT", "/api/v1/goals", token, Map.of("monthlyBudgetKg", 1)).andExpect(status().isOk());
        create(token, activity("TRANSPORT", "CAR_PETROL", 100, today));
        create(token, activity("TRANSPORT", "CAR_PETROL", 100, today));

        JsonNode list = body(send("GET", "/api/v1/notifications", token, null).andExpect(status().isOk()));
        assertThat(list.get("unread").asLong()).isEqualTo(1);
        JsonNode n = list.get("items").get(0);
        assertThat(n.get("kind").asText()).isEqualTo("BUDGET_OVER");
        assertThat(n.get("link").asText()).isEqualTo("/insights");

        send("POST", "/api/v1/notifications/" + n.get("id").asText() + "/read", token, null)
                .andExpect(status().isNoContent());
        send("GET", "/api/v1/notifications", token, null).andExpect(jsonPath("$.unread").value(0))
                .andExpect(jsonPath("$.items[0].read").value(true));

        // Another user cannot touch it.
        String other = newUserToken();
        send("POST", "/api/v1/notifications/" + n.get("id").asText() + "/read", other, null)
                .andExpect(status().isNotFound());
    }

    @Test
    void budgetAlertsRespectTheSetting() throws Exception {
        String token = newUserToken();
        send("PUT", "/api/v1/notifications/settings", token, Map.of("budget", false))
                .andExpect(jsonPath("$.budget").value(false))
                .andExpect(jsonPath("$.templates").value(true))
                .andExpect(jsonPath("$.pushAvailable").value(false));
        send("PUT", "/api/v1/goals", token, Map.of("monthlyBudgetKg", 1)).andExpect(status().isOk());
        create(token, activity("TRANSPORT", "CAR_PETROL", 100, today));
        send("GET", "/api/v1/notifications", token, null).andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void pushSubscriptionIsRefusedWhenNotConfigured() throws Exception {
        String token = newUserToken();
        Map<String, Object> sub = Map.of("endpoint", "https://fcm.googleapis.com/fcm/send/abc",
                "keys", Map.of("p256dh", "x", "auth", "y"));
        send("POST", "/api/v1/notifications/push-subscriptions", token, sub)
                .andExpect(status().isUnprocessableEntity());
        send("GET", "/api/v1/notifications", null, null).andExpect(status().isUnauthorized());
    }

    // ---- 16 market-based electricity -------------------------------------------------------------

    @Test
    void scope2ReportsLocationAndMarketFigures() throws Exception {
        String token = newUserToken();
        create(token, activity("ENERGY", "ELECTRICITY", 100, today));
        JsonNode s = body(send("GET", "/api/v1/insights/scope2", token, null).andExpect(status().isOk()));
        assertThat(s.get("kwh").decimalValue()).isEqualByComparingTo("100");
        assertThat(s.has("marketKg")).isFalse();

        send("PUT", "/api/v1/insights/scope2/supplier", token, Map.of("gramsPerKwh", 50)).andExpect(status().isOk());
        s = body(send("GET", "/api/v1/insights/scope2", token, null));
        assertThat(s.get("marketKg").decimalValue()).isEqualByComparingTo("5");
        send("PUT", "/api/v1/insights/scope2/supplier", token, Map.of("gramsPerKwh", 5000))
                .andExpect(status().isUnprocessableEntity());
    }

    // ---- 17 households ---------------------------------------------------------------------------

    @Test
    void sharedEnergyIsSplitAcrossTheHousehold() throws Exception {
        String a = newUserToken();
        String b = newUserToken();
        send("GET", "/api/v1/household", a, null).andExpect(status().isNoContent());
        send("POST", "/api/v1/household", a, Map.of("name", "Flat 3")).andExpect(status().isCreated());
        String code = body(send("POST", "/api/v1/household/invites", a, null).andExpect(status().isCreated()))
                .get("code").asText();
        send("POST", "/api/v1/household/join", b, Map.of("code", code.toLowerCase().replace("-", "")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.members.length()").value(2));
        // An invite works once.
        send("POST", "/api/v1/household/join", newUserToken(), Map.of("code", code))
                .andExpect(status().isUnprocessableEntity());

        Map<String, Object> req = activity("ENERGY", "ELECTRICITY", 100, today);
        req.put("shareWithHousehold", true);
        JsonNode mine = create(a, req);
        assertThat(mine.get("quantity").decimalValue()).isEqualByComparingTo("50");
        assertThat(mine.get("share").get("count").asInt()).isEqualTo(2);
        assertThat(mine.get("share").get("editable").asBoolean()).isTrue();

        JsonNode theirs = body(send("GET", "/api/v1/activities", b, null)).get("content").get(0);
        assertThat(theirs.get("quantity").decimalValue()).isEqualByComparingTo("50");
        assertThat(theirs.get("share").get("editable").asBoolean()).isFalse();
        assertThat(body(send("GET", "/api/v1/notifications", b, null)).get("items").get(0).get("kind").asText())
                .isEqualTo("HOUSEHOLD");

        // The other member's copy is read-only.
        Map<String, Object> edit = activity("ENERGY", "ELECTRICITY", 60, today);
        edit.put("version", theirs.get("version").asLong());
        send("PUT", "/api/v1/activities/" + theirs.get("id").asText(), b, edit).andExpect(status().isForbidden());
        send("DELETE", "/api/v1/activities/" + theirs.get("id").asText(), b, null).andExpect(status().isForbidden());

        // The creator's change carries to every copy.
        edit.put("version", mine.get("version").asLong());
        send("PUT", "/api/v1/activities/" + mine.get("id").asText(), a, edit).andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(30));
        theirs = body(send("GET", "/api/v1/activities", b, null)).get("content").get(0);
        assertThat(theirs.get("quantity").decimalValue()).isEqualByComparingTo("30");
        assertThat(theirs.get("share").get("totalQuantity").decimalValue()).isEqualByComparingTo("60");

        send("DELETE", "/api/v1/activities/" + mine.get("id").asText(), a, null).andExpect(status().isNoContent());
        assertThat(body(send("GET", "/api/v1/activities", b, null)).get("content").size()).isZero();

        // Only home energy and waste can be shared.
        Map<String, Object> car = activity("TRANSPORT", "CAR_PETROL", 10, today);
        car.put("shareWithHousehold", true);
        send("POST", "/api/v1/activities", a, car).andExpect(status().isUnprocessableEntity());

        send("POST", "/api/v1/household/leave", b, null).andExpect(status().isNoContent());
        send("POST", "/api/v1/activities", a, req).andExpect(status().isUnprocessableEntity());
    }

    // ---- 19 meter import -------------------------------------------------------------------------

    @Test
    void meterExportBooksOneEntryPerDay() throws Exception {
        String token = newUserToken();
        String csv = "Datum;Zählerstand (kWh)\n"
                + today.minusDays(3).format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")) + ";1.000,0\n"
                + today.minusDays(2).format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")) + ";1.008,5\n"
                + today.minusDays(1).format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy")) + ";1.020,0\n";
        Map<String, Object> req = new java.util.HashMap<>(Map.of("csv", csv, "subtype", "ELECTRICITY", "dryRun", true));

        send("POST", "/api/v1/activities/import/meter", token, req).andExpect(status().isOk())
                .andExpect(jsonPath("$.ready").value(2)).andExpect(jsonPath("$.rows[0].quantity").value(8.5));
        assertThat(body(send("GET", "/api/v1/activities", token, null)).get("content").size()).isZero();

        req.put("dryRun", false);
        send("POST", "/api/v1/activities/import/meter", token, req).andExpect(jsonPath("$.imported").value(2));
        // Importing the same file again finds the duplicates.
        send("POST", "/api/v1/activities/import/meter", token, req).andExpect(jsonPath("$.duplicates").value(2))
                .andExpect(jsonPath("$.imported").value(0));

        req.put("subtype", "CAR_PETROL");
        send("POST", "/api/v1/activities/import/meter", token, req).andExpect(status().isUnprocessableEntity());
        req.put("subtype", "ELECTRICITY");
        req.put("csv", "foo;bar\n1;2\n");
        send("POST", "/api/v1/activities/import/meter", token, req).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("meter_format"));
    }
}
