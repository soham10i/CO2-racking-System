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

class ActivityApiTest extends ApiTestSupport {

    @Autowired ActivityRepository activityRepo;

    @Test
    void everyEndpointRequiresAuthentication() throws Exception {
        UUID id = UUID.randomUUID();
        send("GET", "/api/v1/activities", null, null).andExpect(status().isUnauthorized());
        send("POST", "/api/v1/activities", null, activity("TRANSPORT", "BUS", 1, LocalDate.now(ZoneOffset.UTC)))
                .andExpect(status().isUnauthorized());
        send("GET", "/api/v1/activities/" + id, null, null).andExpect(status().isUnauthorized());
        send("PUT", "/api/v1/activities/" + id, null, activity("TRANSPORT", "BUS", 1, LocalDate.now(ZoneOffset.UTC)))
                .andExpect(status().isUnauthorized());
        send("DELETE", "/api/v1/activities/" + id, null, null).andExpect(status().isUnauthorized());
        send("GET", "/api/v1/emission-factors", null, null).andExpect(status().isUnauthorized());
        send("POST", "/api/v1/calculator/estimate", null, activity("TRANSPORT", "BUS", 1, LocalDate.now(ZoneOffset.UTC)))
                .andExpect(status().isUnauthorized());
        send("GET", "/api/v1/dashboard/summary", null, null).andExpect(status().isUnauthorized());
    }

    @Test
    void serverComputesResultAndIgnoresClientSuppliedValues() throws Exception {
        String t = newUserToken();
        Map<String, Object> body = activity("TRANSPORT", "CAR_PETROL", 12, LocalDate.now(ZoneOffset.UTC));
        body.put("kgCo2e", 0.001); // must be ignored
        body.put("unit", "MILES");
        JsonNode a = create(t, body);
        assertThat(a.get("kgCo2e").decimalValue()).isEqualByComparingTo("2.028");
        assertThat(a.get("unit").asText()).isEqualTo("KM");
        assertThat(a.get("factor").get("kgCo2ePerUnit").decimalValue()).isEqualByComparingTo("0.169");
        assertThat(a.get("label").asText()).isEqualTo("Car (petrol)");

        body.put("passengers", 2);
        assertThat(create(t, body).get("kgCo2e").decimalValue()).isEqualByComparingTo("1.014");
    }

    @Test
    void regionalFactorBeatsGlobalAndGlobalIsTheFallback() throws Exception {
        String t = newUserToken();
        Map<String, Object> body = activity("ENERGY", "ELECTRICITY", 100, LocalDate.now(ZoneOffset.UTC));
        send("POST", "/api/v1/calculator/estimate", t, body).andExpect(status().isOk())
                .andExpect(jsonPath("$.kgCo2e").value(48.0));
        setCountry(t, "DE");
        send("POST", "/api/v1/calculator/estimate", t, body).andExpect(status().isOk())
                .andExpect(jsonPath("$.kgCo2e").value(38.0));
        send("GET", "/api/v1/emission-factors?category=ENERGY", t, null).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.subtype=='ELECTRICITY')]").value(org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$[?(@.subtype=='ELECTRICITY')].kgCo2ePerUnit")
                        .value(org.hamcrest.Matchers.contains(0.38)));
    }

    @Test
    void estimateStoresNothing() throws Exception {
        String t = newUserToken();
        send("POST", "/api/v1/calculator/estimate", t, activity("TRANSPORT", "BUS", 10, LocalDate.now(ZoneOffset.UTC)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.kgCo2e").value(1.0));
        send("GET", "/api/v1/activities", t, null).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void rejectsInvalidInput() throws Exception {
        String t = newUserToken();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        send("POST", "/api/v1/activities", t, activity("TRANSPORT", "BUS", 0, today))
                .andExpect(status().isUnprocessableEntity());
        send("POST", "/api/v1/activities", t, activity("TRANSPORT", "BUS", -5, today))
                .andExpect(status().isUnprocessableEntity());
        send("POST", "/api/v1/activities", t, activity("TRANSPORT", "BUS", 10, today.plusDays(2)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("date_in_future"));
        send("POST", "/api/v1/activities", t, activity("TRANSPORT", "BUS", 10, today.minusYears(11)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("date_too_old"));
        send("POST", "/api/v1/activities", t, activity("TRANSPORT", "WARP_DRIVE", 10, today))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("unknown_subtype"));
        send("POST", "/api/v1/activities", t, activity("ENERGY", "BUS", 10, today))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("unknown_subtype"));
        send("POST", "/api/v1/activities", t, activity("TRANSPORT", "BUS", 999999, today))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("quantity_out_of_range"));
        send("POST", "/api/v1/activities", t, activity("TRANSPORT", "bus'; drop table activity;--", 1, today))
                .andExpect(status().isUnprocessableEntity());
        send("POST", "/api/v1/activities", t, activity("SPACE", "BUS", 1, today)).andExpect(status().isBadRequest());
        Map<String, Object> shared = activity("TRANSPORT", "BUS", 10, today);
        shared.put("passengers", 3);
        send("POST", "/api/v1/activities", t, shared).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("passengers_not_applicable"));
        Map<String, Object> tooMany = activity("TRANSPORT", "CAR_PETROL", 10, today);
        tooMany.put("passengers", 10);
        send("POST", "/api/v1/activities", t, tooMany).andExpect(status().isUnprocessableEntity());
        Map<String, Object> longNote = activity("TRANSPORT", "BUS", 1, today);
        longNote.put("note", "x".repeat(201));
        send("POST", "/api/v1/activities", t, longNote).andExpect(status().isUnprocessableEntity());
        send("GET", "/api/v1/activities", t, null).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void usersCannotSeeChangeOrDeleteEachOthersActivities() throws Exception {
        String alice = newUserToken();
        String bob = newUserToken();
        JsonNode a = create(alice, activity("TRANSPORT", "BUS", 10, LocalDate.now(ZoneOffset.UTC)));
        String id = a.get("id").asText();

        send("GET", "/api/v1/activities/" + id, bob, null).andExpect(status().isNotFound());
        Map<String, Object> change = activity("TRANSPORT", "BUS", 99, LocalDate.now(ZoneOffset.UTC));
        change.put("version", a.get("version").asLong());
        send("PUT", "/api/v1/activities/" + id, bob, change).andExpect(status().isNotFound());
        send("DELETE", "/api/v1/activities/" + id, bob, null).andExpect(status().isNotFound());
        send("GET", "/api/v1/activities", bob, null).andExpect(jsonPath("$.totalElements").value(0));
        send("GET", "/api/v1/dashboard/summary", bob, null).andExpect(jsonPath("$.year").value(0));

        // Alice's data is untouched.
        send("GET", "/api/v1/activities/" + id, alice, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(10));
    }

    @Test
    void updateRecalculatesAndDetectsStaleVersions() throws Exception {
        String t = newUserToken();
        JsonNode a = create(t, activity("TRANSPORT", "CAR_PETROL", 10, LocalDate.now(ZoneOffset.UTC)));
        String id = a.get("id").asText();

        Map<String, Object> change = activity("TRANSPORT", "CAR_DIESEL", 20, LocalDate.now(ZoneOffset.UTC));
        send("PUT", "/api/v1/activities/" + id, t, change).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("version_required"));

        change.put("version", a.get("version").asLong());
        String updated = send("PUT", "/api/v1/activities/" + id, t, change).andExpect(status().isOk())
                .andExpect(jsonPath("$.kgCo2e").value(3.22)).andExpect(jsonPath("$.subtype").value("CAR_DIESEL"))
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(updated).get("version").asLong()).isGreaterThan(a.get("version").asLong());

        // Re-sending the old version is rejected.
        send("PUT", "/api/v1/activities/" + id, t, change).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("stale_version"));
    }

    @Test
    void deleteRemovesTheActivity() throws Exception {
        String t = newUserToken();
        String id = create(t, activity("ENERGY", "NATURAL_GAS", 50, LocalDate.now(ZoneOffset.UTC))).get("id").asText();
        send("DELETE", "/api/v1/activities/" + id, t, null).andExpect(status().isNoContent());
        send("GET", "/api/v1/activities/" + id, t, null).andExpect(status().isNotFound());
        send("DELETE", "/api/v1/activities/" + id, t, null).andExpect(status().isNotFound());
    }

    @Test
    void listFiltersPaginatesAndCapsPageSize() throws Exception {
        String t = newUserToken();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        create(t, activity("TRANSPORT", "BUS", 10, today.minusDays(3)));
        create(t, activity("TRANSPORT", "BUS", 20, today.minusDays(1)));
        create(t, activity("ENERGY", "NATURAL_GAS", 30, today.minusDays(2)));

        send("GET", "/api/v1/activities", t, null).andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].quantity").value(20))
                .andExpect(jsonPath("$.content[2].quantity").value(10));
        send("GET", "/api/v1/activities?category=ENERGY", t, null).andExpect(jsonPath("$.totalElements").value(1));
        send("GET", "/api/v1/activities?subtype=BUS", t, null).andExpect(jsonPath("$.totalElements").value(2));
        send("GET", "/api/v1/activities?from=" + today.minusDays(2) + "&to=" + today.minusDays(1), t, null)
                .andExpect(jsonPath("$.totalElements").value(2));
        send("GET", "/api/v1/activities?size=2&page=1", t, null).andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalPages").value(2));
        send("GET", "/api/v1/activities?size=100000", t, null).andExpect(jsonPath("$.size").value(100));
        send("GET", "/api/v1/activities?sort=password_hash,desc", t, null).andExpect(status().isOk());
        send("GET", "/api/v1/activities?category=SPACE", t, null).andExpect(status().isBadRequest());
    }

    @Test
    void dashboardSummaryTotalsAndAccountDeletionCascade() throws Exception {
        String t = newUserToken();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        create(t, activity("TRANSPORT", "BUS", 10, today));                 // 1.0 today
        create(t, activity("ENERGY", "NATURAL_GAS", 50, today));            // 9.1 today
        create(t, activity("TRANSPORT", "BUS", 100, today.minusYears(1)));  // outside this year

        send("GET", "/api/v1/dashboard/summary?date=" + today, t, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value(10.1))
                .andExpect(jsonPath("$.week").value(org.hamcrest.Matchers.greaterThanOrEqualTo(10.1)))
                .andExpect(jsonPath("$.month").value(org.hamcrest.Matchers.greaterThanOrEqualTo(10.1)))
                .andExpect(jsonPath("$.year").value(org.hamcrest.Matchers.greaterThanOrEqualTo(10.1)))
                .andExpect(jsonPath("$.monthByCategory.length()").value(5))
                .andExpect(jsonPath("$.monthByCategory[?(@.category=='ENERGY')].kgCo2e")
                        .value(org.hamcrest.Matchers.contains(9.1)));

        long before = activityRepo.count();
        assertThat(before).isGreaterThanOrEqualTo(3);
        send("DELETE", "/api/v1/me", t, Map.of("password", PASSWORD)).andExpect(status().isNoContent());
        assertThat(activityRepo.count()).isEqualTo(before - 3);
    }
}
