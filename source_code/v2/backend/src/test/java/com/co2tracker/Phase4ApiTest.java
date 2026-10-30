package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.co2tracker.insights.DigestService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class Phase4ApiTest extends ApiTestSupport {

    @Autowired DigestService digests;

    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    private Map<String, Object> template(String name, String recurrence, LocalDate startsOn) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("category", "TRANSPORT");
        m.put("subtype", "CAR_PETROL");
        m.put("quantity", 10);
        m.put("recurrence", recurrence);
        if (startsOn != null) {
            m.put("startsOn", startsOn.toString());
        }
        return m;
    }

    private JsonNode body(org.springframework.test.web.servlet.ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private long activityCount(String token) throws Exception {
        return body(send("GET", "/api/v1/activities", token, null).andExpect(status().isOk()))
                .get("totalElements").asLong();
    }

    // ---- templates -----------------------------------------------------------------------------

    @Test
    void templateLogsOneTapAndIsOwnerScoped() throws Exception {
        String token = newUserToken();
        JsonNode t = body(send("POST", "/api/v1/templates", token, template("Commute", "NONE", null))
                .andExpect(status().isCreated()));
        assertThat(t.get("kgCo2e").decimalValue()).isEqualByComparingTo("1.690");
        assertThat(t.get("label").asText()).isEqualTo("Car (petrol)");
        assertThat(t.has("nextRunOn")).isFalse();

        String id = t.get("id").asText();
        send("POST", "/api/v1/templates/" + id + "/log", token, null).andExpect(status().isCreated())
                .andExpect(jsonPath("$.occurredOn").value(today.toString()))
                .andExpect(jsonPath("$.kgCo2e").value(1.69));
        assertThat(activityCount(token)).isEqualTo(1);

        String other = newUserToken();
        send("POST", "/api/v1/templates/" + id + "/log", other, null).andExpect(status().isNotFound());
        send("DELETE", "/api/v1/templates/" + id, other, null).andExpect(status().isNotFound());

        Map<String, Object> rename = template("Office", "NONE", null);
        rename.put("version", t.get("version").asLong());
        send("PUT", "/api/v1/templates/" + id, token, rename).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Office"));
        send("PUT", "/api/v1/templates/" + id, token, rename).andExpect(status().isConflict());

        send("DELETE", "/api/v1/templates/" + id, token, null).andExpect(status().isNoContent());
        assertThat(activityCount(token)).isEqualTo(1); // booked entries stay
    }

    @Test
    void templateRejectsUnknownSubtypeAndOversizedQuantity() throws Exception {
        String token = newUserToken();
        Map<String, Object> bad = template("x", "NONE", null);
        bad.put("subtype", "ROCKET");
        send("POST", "/api/v1/templates", token, bad).andExpect(status().isUnprocessableEntity());
        bad = template("x", "NONE", null);
        bad.put("quantity", 99_999_999);
        send("POST", "/api/v1/templates", token, bad).andExpect(status().isUnprocessableEntity());
    }

    @Test
    void recurringTemplateBooksMissedDaysOnceAndNeverTwice() throws Exception {
        String token = newUserToken();
        JsonNode t = body(send("POST", "/api/v1/templates", token, template("Daily", "DAILY", today.minusDays(2)))
                .andExpect(status().isCreated()));
        assertThat(t.get("nextRunOn").asText()).isEqualTo(today.plusDays(1).toString());
        assertThat(activityCount(token)).isEqualTo(3);

        // Editing the quantity keeps the schedule: nothing is booked again.
        Map<String, Object> edit = template("Daily", "DAILY", today.minusDays(2));
        edit.put("quantity", 20);
        edit.put("version", t.get("version").asLong());
        send("PUT", "/api/v1/templates/" + t.get("id").asText(), token, edit).andExpect(status().isOk());
        assertThat(activityCount(token)).isEqualTo(3);

        send("POST", "/api/v1/templates", token, template("Old", "DAILY", today.minusDays(60)))
                .andExpect(status().isUnprocessableEntity());
    }

    // ---- budget ----------------------------------------------------------------------------------

    @Test
    void budgetDefaultsToTheTargetAndTracksTheMonth() throws Exception {
        String token = newUserToken();
        send("GET", "/api/v1/goals", token, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyBudgetKg").value(208.3))
                .andExpect(jsonPath("$.defaultBudget").value(true))
                .andExpect(jsonPath("$.status").value("ON_TRACK"));

        create(token, activity("DIET", "MEAL_BEEF", 10, today)); // 104.48 kg
        send("PUT", "/api/v1/goals", token, Map.of("monthlyBudgetKg", 100)).andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyBudgetKg").value(100.0))
                .andExpect(jsonPath("$.defaultBudget").value(false))
                .andExpect(jsonPath("$.monthToDateKg").value(104.5))
                .andExpect(jsonPath("$.remainingKg").value(0.0))
                .andExpect(jsonPath("$.status").value("OVER"));

        Map<String, Object> reset = new HashMap<>();
        reset.put("monthlyBudgetKg", null);
        send("PUT", "/api/v1/goals", token, reset).andExpect(jsonPath("$.defaultBudget").value(true));
        send("PUT", "/api/v1/goals", token, Map.of("monthlyBudgetKg", 0)).andExpect(status().isUnprocessableEntity());
    }

    // ---- baseline --------------------------------------------------------------------------------

    private Map<String, Object> answers() {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("householdSize", 2);
        a.put("carFuel", "PETROL");
        a.put("carKmPerWeek", 100);
        a.put("busKmPerWeek", 0);
        a.put("trainKmPerWeek", 0);
        a.put("shortHaulReturnFlightsPerYear", 0);
        a.put("longHaulReturnFlightsPerYear", 0);
        a.put("electricityKwhPerYear", 2000);
        a.put("heatingType", "DISTRICT");
        a.put("heatingPerYear", 5000);
        a.put("beefOrLambMealsPerWeek", 0);
        a.put("otherMeatMealsPerWeek", 0);
        a.put("vegan", false);
        a.put("phonesPerYear", 0);
        a.put("laptopsPerYear", 0);
        a.put("clothingItemsPerYear", 0);
        a.put("residualWasteKgPerWeek", 0);
        a.put("recyclingKgPerWeek", 0);
        return a;
    }

    @Test
    void baselineEstimatesFromFactorsAndCompletesOnboarding() throws Exception {
        String token = newUserToken();
        send("GET", "/api/v1/baseline", token, null).andExpect(status().isNoContent());

        JsonNode b = body(send("PUT", "/api/v1/baseline", token, answers()).andExpect(status().isOk()));
        // Car: 100 km × 52 × 0.169 = 878.8; electricity 2000 kWh × 0.48 / 2 = 480.0;
        // diet 14 vegetarian meals × 52 × 0.967 = 704.0; district heating is not estimated.
        Map<String, Double> byCategory = new HashMap<>();
        b.get("byCategory").forEach(c -> byCategory.put(c.get("category").asText(), c.get("annualKg").asDouble()));
        assertThat(byCategory).containsEntry("TRANSPORT", 878.8).containsEntry("ENERGY", 480.0)
                .containsEntry("DIET", 704.0).containsEntry("WASTE", 0.0);
        assertThat(b.get("annualKg").asDouble()).isEqualTo(2062.8);
        assertThat(b.get("assumptions").size()).isPositive();
        assertThat(b.get("savedAt").isNull()).isFalse();

        send("GET", "/api/v1/me", token, null)
                .andExpect(jsonPath("$.profile.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.profile.householdSize").value(2));
        send("GET", "/api/v1/baseline", token, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.annualKg").value(2062.8));

        Map<String, Object> bad = answers();
        bad.put("householdSize", 0);
        send("POST", "/api/v1/baseline/estimate", token, bad).andExpect(status().isUnprocessableEntity());
    }

    // ---- what-if actions ---------------------------------------------------------------------------

    @Test
    void actionsComeFromTheUsersOwnEntries() throws Exception {
        String token = newUserToken();
        send("GET", "/api/v1/insights/actions", token, null).andExpect(jsonPath("$.actions.length()").value(0));

        create(token, activity("DIET", "MEAL_BEEF", 1, today));
        JsonNode r = body(send("GET", "/api/v1/insights/actions", token, null).andExpect(status().isOk()));
        assertThat(r.get("windowDays").asInt()).isEqualTo(7);
        Map<String, Double> saving = new HashMap<>();
        r.get("actions").forEach(a -> saving.put(a.get("key").asText(), a.get("annualSavingKg").asDouble()));
        // (10.448 − 1.487) × 365 / 7 = 467.3 and 0.5 × (10.448 − 0.967) × 365 / 7 = 247.2
        assertThat(saving).containsEntry("red_meat_to_poultry", 467.3)
                .containsEntry("red_meat_to_vegetarian", 247.2).doesNotContainKey("car_to_train");
        assertThat(r.get("actions").get(0).get("key").asText()).isEqualTo("red_meat_to_poultry");
    }

    // ---- weekly digest --------------------------------------------------------------------------------

    @Test
    void digestGoesOutOncePerMondayToOptedInUsers() throws Exception {
        String token = newUserToken();
        String email = body(send("GET", "/api/v1/me", token, null)).get("email").asText();
        mvc.perform(patch("/api/v1/me/preferences").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"digestOptIn\":true}"))
                .andExpect(status().isOk());
        create(token, activity("DIET", "MEAL_BEEF", 1, today));

        var monday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY)).atTime(9, 0).toInstant(ZoneOffset.UTC);
        digests.sendDue(monday.minusSeconds(2 * 3600)); // 07:00: too early
        digests.sendDue(monday);
        digests.sendDue(monday.plusSeconds(3600));
        verify(mail, times(1)).sendWeeklyDigest(eq(email), anyString(), contains("10.4 kg CO2e"));
    }
}
