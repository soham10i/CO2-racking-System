package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;

class Phase5ApiTest extends ApiTestSupport {

    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    private JsonNode body(org.springframework.test.web.servlet.ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private static boolean hasKey(JsonNode list, String key) {
        for (JsonNode n : list) {
            if (n.get("key").asText().equals(key)) {
                return true;
            }
        }
        return false;
    }

    // ---- suggestion lifecycle --------------------------------------------------------------------

    @Test
    void adoptedActionBecomesACommitmentAndCanBeUndone() throws Exception {
        String token = newUserToken();
        create(token, activity("DIET", "MEAL_BEEF", 1, today));
        String path = "/api/v1/insights/actions/red_meat_to_poultry/decision";

        JsonNode r = body(send("PUT", path, token, Map.of("status", "ADOPTED")).andExpect(status().isOk()));
        assertThat(hasKey(r.get("actions"), "red_meat_to_poultry")).isFalse();
        JsonNode c = r.get("commitments").get(0);
        assertThat(c.get("key").asText()).isEqualTo("red_meat_to_poultry");
        assertThat(c.get("expectedAnnualKg").asDouble()).isEqualTo(467.3);
        assertThat(c.get("adoptedOn").asText()).isEqualTo(today.toString());
        assertThat(c.has("realisedAnnualKg")).isFalse(); // measured after 7 days

        r = body(send("DELETE", path, token, null).andExpect(status().isOk()));
        assertThat(r.get("commitments").size()).isZero();
        assertThat(hasKey(r.get("actions"), "red_meat_to_poultry")).isTrue();
    }

    @Test
    void dismissAndSnoozeHideTheSuggestion() throws Exception {
        String token = newUserToken();
        create(token, activity("DIET", "MEAL_BEEF", 1, today));

        JsonNode r = body(send("PUT", "/api/v1/insights/actions/red_meat_to_vegetarian/decision", token,
                Map.of("status", "DISMISSED")).andExpect(status().isOk()));
        assertThat(hasKey(r.get("actions"), "red_meat_to_vegetarian")).isFalse();
        assertThat(r.get("hidden").get(0).get("status").asText()).isEqualTo("DISMISSED");

        r = body(send("PUT", "/api/v1/insights/actions/red_meat_to_poultry/decision", token,
                Map.of("status", "SNOOZED", "snoozeDays", 14)).andExpect(status().isOk()));
        assertThat(r.get("actions").size()).isZero();
        assertThat(r.get("hidden").size()).isEqualTo(2);
        assertThat(r.toString()).contains(today.plusDays(14).toString());

        send("PUT", "/api/v1/insights/actions/nope/decision", token, Map.of("status", "DISMISSED"))
                .andExpect(status().isNotFound());
        send("PUT", "/api/v1/insights/actions/car_to_train/decision", token, Map.of("status", "ADOPTED"))
                .andExpect(status().isUnprocessableEntity()); // nothing to adopt without car trips
        send("PUT", "/api/v1/insights/actions/car_to_train/decision", token,
                Map.of("status", "SNOOZED", "snoozeDays", 0)).andExpect(status().isUnprocessableEntity());
    }

    // ---- export / import -----------------------------------------------------------------------

    @Test
    void exportsJsonAndCsv() throws Exception {
        String token = newUserToken();
        Map<String, Object> a = activity("DIET", "MEAL_BEEF", 2, today);
        a.put("note", "=HYPERLINK(\"x\")");
        create(token, a);

        send("GET", "/api/v1/me/export", token, null).andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString(".json")))
                .andExpect(jsonPath("$.format").value("co2-tracker-export/1"))
                .andExpect(jsonPath("$.activities.length()").value(1))
                .andExpect(jsonPath("$.account.email").exists());

        String csv = send("GET", "/api/v1/activities/export", token, null).andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.startsWith("text/csv")))
                .andReturn().getResponse().getContentAsString();
        String[] lines = csv.split("\r\n");
        assertThat(lines[0]).isEqualTo("date,category,subtype,label,quantity,unit,passengers,kg_co2e,factor_source,note");
        assertThat(lines[1]).startsWith(today + ",DIET,MEAL_BEEF,").contains(",2,").endsWith("\"'=HYPERLINK(\"\"x\"\")\"");

        send("GET", "/api/v1/activities/export", null, null).andExpect(status().isUnauthorized());
    }

    @Test
    void importPreviewsRowsThenSavesOnlyValidNewOnes() throws Exception {
        String token = newUserToken();
        create(token, activity("DIET", "MEAL_BEEF", 1, today));
        String csv = "Date,Category,Subtype,Quantity,Passengers,Note\n"
                + today + ",diet,meal_beef,1,,dup of existing\n"
                + today + ",TRANSPORT,CAR_PETROL,\"12,5\",2,\"commute, shared\"\n"
                + "30.10.2026,DIET,MEAL_VEGAN,1,,\n"
                + today + ",DIET,ROCKET,1,,\n"
                + today + ",TRANSPORT,CAR_PETROL,12.5,2,repeat in file\n"
                + today.plusDays(3) + ",DIET,MEAL_VEGAN,1,,\n";

        JsonNode preview = body(send("POST", "/api/v1/activities/import", token,
                Map.of("csv", csv, "dryRun", true)).andExpect(status().isOk()));
        assertThat(preview.get("ready").asInt()).isEqualTo(1);
        assertThat(preview.get("duplicates").asInt()).isEqualTo(2);
        assertThat(preview.get("errors").asInt()).isEqualTo(3);
        assertThat(preview.get("rows").get(1).get("line").asInt()).isEqualTo(3);
        assertThat(preview.get("rows").get(2).get("message").asText()).contains("Date");
        assertThat(body(send("GET", "/api/v1/activities", token, null)).get("totalElements").asInt()).isEqualTo(1);

        JsonNode done = body(send("POST", "/api/v1/activities/import", token,
                Map.of("csv", csv, "dryRun", false)).andExpect(status().isOk()));
        assertThat(done.get("imported").asInt()).isEqualTo(1);
        JsonNode list = body(send("GET", "/api/v1/activities", token, null));
        assertThat(list.get("totalElements").asInt()).isEqualTo(2);
        assertThat(list.toString()).contains("commute, shared");

        send("POST", "/api/v1/activities/import", token, Map.of("csv", "foo,bar\n1,2", "dryRun", true))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void exportedCsvImportsBackAsDuplicates() throws Exception {
        String token = newUserToken();
        create(token, activity("ENERGY", "ELECTRICITY", 120, today));
        String csv = send("GET", "/api/v1/activities/export", token, null).andReturn().getResponse()
                .getContentAsString();
        send("POST", "/api/v1/activities/import", token, Map.of("csv", csv, "dryRun", true))
                .andExpect(jsonPath("$.duplicates").value(1)).andExpect(jsonPath("$.errors").value(0));

        String other = newUserToken();
        send("POST", "/api/v1/activities/import", other, Map.of("csv", csv, "dryRun", false))
                .andExpect(jsonPath("$.imported").value(1));
    }
}
