package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class AnalyticsApiTest extends ApiTestSupport {

    // 2026-03-02 is a Monday; these dates use factors valid since 2024 (bus v1, diet v1).
    private static final LocalDate MON = LocalDate.of(2026, 3, 2);

    @Autowired JdbcTemplate jdbc;

    private Map<String, BigDecimal> grouped(String sql, UUID userId) {
        Map<String, BigDecimal> m = new HashMap<>();
        jdbc.query(sql, rs -> {
            m.put(rs.getObject(1, LocalDate.class) + "/" + rs.getString(2), rs.getBigDecimal(3).stripTrailingZeros());
        }, userId);
        return m;
    }

    @Test
    void projectionEqualsActivityTotalsAfterCreateUpdateAndDelete() throws Exception {
        String t = newUserToken();
        JsonNode a = create(t, activity("TRANSPORT", "BUS", 10, MON));
        create(t, activity("TRANSPORT", "BUS", 5, MON));
        JsonNode c = create(t, activity("DIET", "MEAL_BEEF", 2, MON.plusDays(1)));
        JsonNode d = create(t, activity("WASTE", "LANDFILL", 3, MON.plusDays(2)));

        // Move one trip to another day and category; delete another entry.
        Map<String, Object> change = activity("ENERGY", "NATURAL_GAS", 100, MON.plusDays(3));
        change.put("version", a.get("version").asLong());
        send("PUT", "/api/v1/activities/" + a.get("id").asText(), t, change).andExpect(status().isOk());
        send("DELETE", "/api/v1/activities/" + d.get("id").asText(), t, null).andExpect(status().isNoContent());

        UUID userId = jdbc.queryForObject("SELECT user_id FROM activity WHERE id = ?", UUID.class,
                UUID.fromString(c.get("id").asText()));
        Map<String, BigDecimal> fromActivities = grouped("""
                SELECT occurred_on, category, SUM(kg_co2e) FROM activity WHERE user_id = ?
                GROUP BY occurred_on, category""", userId);
        Map<String, BigDecimal> fromProjection = grouped(
                "SELECT occurred_on, category, kg_co2e FROM daily_emission WHERE user_id = ?", userId);
        assertThat(fromProjection).isEqualTo(fromActivities).hasSize(3); // the waste day was removed entirely
    }

    @Test
    void trendIsZeroFilledAndUsesIsoWeeks() throws Exception {
        String t = newUserToken();
        create(t, activity("TRANSPORT", "BUS", 10, MON.plusDays(2)));     // Wed: 1.0
        create(t, activity("DIET", "MEAL_BEEF", 1, MON.plusDays(8)));     // next Tue: 10.448

        LocalDate from = MON.plusDays(2);
        LocalDate to = MON.plusDays(13);
        send("GET", "/api/v1/dashboard/trend?granularity=DAY&from=" + from + "&to=" + to, t, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.buckets", hasSize(12)))
                .andExpect(jsonPath("$.buckets[0].total").value(1.0))
                .andExpect(jsonPath("$.buckets[1].total").value(0))
                .andExpect(jsonPath("$.buckets[6].byCategory.DIET").value(10.448));

        send("GET", "/api/v1/dashboard/trend?granularity=WEEK&from=" + from + "&to=" + to, t, null)
                .andExpect(jsonPath("$.buckets", hasSize(2)))
                .andExpect(jsonPath("$.buckets[0].start").value(from.toString()))   // clipped to the range
                .andExpect(jsonPath("$.buckets[0].end").value(MON.plusDays(6).toString()))
                .andExpect(jsonPath("$.buckets[1].start").value(MON.plusDays(7).toString()))
                .andExpect(jsonPath("$.buckets[1].total").value(10.448));
        assertThat(MON.plusDays(7).getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);

        send("GET", "/api/v1/dashboard/trend?granularity=MONTH&from=2026-01-15&to=" + to, t, null)
                .andExpect(jsonPath("$.buckets", hasSize(3)))
                .andExpect(jsonPath("$.buckets[0].start").value("2026-01-15"))
                .andExpect(jsonPath("$.buckets[2].total").value(11.448));
    }

    @Test
    void compareUsesTheEquallyLongPreviousPeriod() throws Exception {
        String t = newUserToken();
        create(t, activity("TRANSPORT", "BUS", 10, MON.plusDays(2)));   // previous period: 1.0
        create(t, activity("TRANSPORT", "BUS", 20, MON.plusDays(8)));   // current period: 2.0

        send("GET", "/api/v1/dashboard/compare?from=" + MON.plusDays(6) + "&to=" + MON.plusDays(12), t, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.total").value(2.0))
                .andExpect(jsonPath("$.previous.from").value(MON.minusDays(1).toString()))
                .andExpect(jsonPath("$.previous.to").value(MON.plusDays(5).toString()))
                .andExpect(jsonPath("$.previous.total").value(1.0))
                .andExpect(jsonPath("$.changePct").value(100.0))
                .andExpect(jsonPath("$.categories[?(@.category=='TRANSPORT')].changePct")
                        .value(org.hamcrest.Matchers.contains(100.0)))
                // A change from zero is undefined and therefore omitted.
                .andExpect(jsonPath("$.categories[?(@.category=='DIET')].changePct").isEmpty());
    }

    @Test
    void benchmarksAnnualiseOnlyWithEnoughData() throws Exception {
        String t = newUserToken();
        send("GET", "/api/v1/dashboard/benchmarks", t, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(0))
                .andExpect(jsonPath("$.annualTonnes").doesNotExist())
                .andExpect(jsonPath("$.references", hasSize(4)));

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        create(t, activity("TRANSPORT", "BUS", 200, today.minusDays(9)));   // 20 kg over a 10-day window
        send("GET", "/api/v1/dashboard/benchmarks", t, null)
                .andExpect(jsonPath("$.days").value(10))
                .andExpect(jsonPath("$.windowKgCo2e").value(20.0))
                .andExpect(jsonPath("$.annualTonnes").value(0.73));             // 20 / 10 x 365 / 1000
    }

    @Test
    void newCategoriesUseTheStandardStrategy() throws Exception {
        String t = newUserToken();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        send("POST", "/api/v1/calculator/estimate", t, activity("DIET", "MEAL_BEEF", 2, today))
                .andExpect(status().isOk()).andExpect(jsonPath("$.kgCo2e").value(20.896));
        send("POST", "/api/v1/calculator/estimate", t, activity("WASTE", "LANDFILL", 3, today))
                .andExpect(jsonPath("$.kgCo2e").value(1.5));
        send("POST", "/api/v1/calculator/estimate", t, activity("SHOPPING", "JEANS", 1, today))
                .andExpect(jsonPath("$.unit").value("ITEM"));

        Map<String, Object> shared = activity("DIET", "MEAL_VEGAN", 1, today);
        shared.put("passengers", 2);
        send("POST", "/api/v1/activities", t, shared).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("passengers_not_applicable"));
        send("POST", "/api/v1/activities", t, activity("DIET", "MEAL_BEEF", 11, today))
                .andExpect(jsonPath("$.code").value("quantity_out_of_range"));

        send("GET", "/api/v1/emission-factors?category=DIET", t, null)
                .andExpect(jsonPath("$", hasSize(7)))
                .andExpect(jsonPath("$[0].methodNote").isNotEmpty())
                .andExpect(jsonPath("$[0].sourceUrl").value("https://doi.org/10.1126/science.aaq0216"));
    }

    @Test
    void rangesAreValidatedAndEndpointsRequireAuthentication() throws Exception {
        String t = newUserToken();
        send("GET", "/api/v1/dashboard/trend?from=2026-03-10&to=2026-03-01", t, null)
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("invalid_range"));
        send("GET", "/api/v1/dashboard/trend?granularity=DAY&from=2025-01-01&to=2026-03-01", t, null)
                .andExpect(jsonPath("$.code").value("range_too_large"));
        send("GET", "/api/v1/dashboard/trend?granularity=WEEK&from=2022-01-01&to=2026-03-01", t, null)
                .andExpect(jsonPath("$.code").value("range_too_large"));
        send("GET", "/api/v1/dashboard/trend?granularity=HOUR", t, null).andExpect(status().isBadRequest());
        send("GET", "/api/v1/dashboard/compare?from=2026-03-10&to=2026-03-01", t, null)
                .andExpect(jsonPath("$.code").value("invalid_range"));

        for (String path : new String[] {"trend", "compare", "benchmarks"}) {
            send("GET", "/api/v1/dashboard/" + path, null, null).andExpect(status().isUnauthorized());
        }
    }
}
