package com.co2tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.co2tracker.grid.GridSignalFetcher;
import com.co2tracker.grid.GridSignalService;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Daily plan, grid signal and calculator compare (docs/11). The grid upstream is always mocked. */
class PlanApiTest extends ApiTestSupport {

    /** System time plus an offset the test can move forward ("tomorrow", "in three days"). */
    static final class ShiftedClock extends Clock {
        volatile Duration offset = Duration.ZERO;

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return Clock.offset(Clock.system(zone), offset);
        }

        @Override
        public Instant instant() {
            return Instant.now().plus(offset);
        }
    }

    @TestConfiguration
    static class ClockOverride {
        @Bean
        @Primary
        ShiftedClock shiftedClock() {
            return new ShiftedClock();
        }
    }

    @Autowired ShiftedClock clock;
    @Autowired GridSignalService grid;
    @MockBean GridSignalFetcher fetcher;

    @BeforeEach
    void reset() throws Exception {
        clock.offset = Duration.ZERO;
        grid.evict();
        doThrow(new java.io.IOException("offline in tests")).when(fetcher).fetch();
    }

    private JsonNode plan(String token) throws Exception {
        return json.readTree(send("GET", "/api/v1/plan/today", token, null).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private static List<String> keys(JsonNode plan) {
        List<String> keys = new ArrayList<>();
        plan.get("cards").forEach(c -> keys.add(c.get("key").asText()));
        return keys;
    }

    private void feedback(String token, String key, String event) throws Exception {
        send("POST", "/api/v1/plan/cards/" + key + "/feedback", token, Map.of("event", event))
                .andExpect(status().isNoContent());
    }

    private String userWithBeef() throws Exception {
        String token = newUserToken();
        setCountry(token, "DE");
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (int i = 0; i < 3; i++) {
            create(token, activity("DIET", "MEAL_BEEF", 1, today.minusDays(i)));
        }
        return token;
    }

    // ---- calculator compare ------------------------------------------------------------------

    @Test
    void compareListsSameUnitAlternativesCheapestFirst() throws Exception {
        String token = newUserToken();
        String body = send("POST", "/api/v1/calculator/compare", token,
                Map.of("category", "TRANSPORT", "subtype", "CAR_PETROL", "quantity", 10))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chosen.subtype").value("CAR_PETROL"))
                .andExpect(jsonPath("$.chosen.unit").value("KM"))
                .andReturn().getResponse().getContentAsString();
        JsonNode res = json.readTree(body);
        BigDecimal chosen = res.at("/chosen/kgCo2e").decimalValue();
        JsonNode alts = res.get("alternatives");
        assertThat(alts.size()).isGreaterThan(3);
        BigDecimal previous = null;
        for (JsonNode a : alts) {
            assertThat(a.get("unit").asText()).isEqualTo("KM");
            assertThat(a.get("subtype").asText()).isNotEqualTo("CAR_PETROL");
            BigDecimal kg = a.get("kgCo2e").decimalValue();
            assertThat(a.get("savingKg").decimalValue()).isEqualByComparingTo(chosen.subtract(kg));
            if (previous != null) {
                assertThat(kg).isGreaterThanOrEqualTo(previous);
            }
            previous = kg;
        }
        assertThat(alts.get(0).get("subtype").asText()).isEqualTo("BIKE_WALK");

        // A low-emission choice gets negative savings, sign kept.
        String diet = send("POST", "/api/v1/calculator/compare", token,
                Map.of("category", "DIET", "subtype", "MEAL_VEGAN", "quantity", 1))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode d = json.readTree(diet);
        d.get("alternatives").forEach(a -> {
            assertThat(a.get("unit").asText()).isEqualTo("MEAL");
            assertThat(a.get("savingKg").decimalValue().signum()).isLessThanOrEqualTo(0);
        });

        send("POST", "/api/v1/calculator/compare", token,
                Map.of("category", "TRANSPORT", "subtype", "NOPE", "quantity", 1))
                .andExpect(status().isUnprocessableEntity());
        send("POST", "/api/v1/calculator/compare", null,
                Map.of("category", "TRANSPORT", "subtype", "CAR_PETROL", "quantity", 1))
                .andExpect(status().isUnauthorized());
    }

    // ---- plan --------------------------------------------------------------------------------

    @Test
    void coldStartGivesAtMostThreeCardsAndFallbackGrid() throws Exception {
        String token = newUserToken();
        JsonNode plan = plan(token);
        assertThat(plan.get("date").asText()).isEqualTo(LocalDate.now(ZoneOffset.UTC).toString());
        assertThat(plan.get("cards").size()).isBetween(1, 3);
        assertThat(keys(plan)).contains("PLANT_DAY").doesNotContain("MEAL_SWAP", "COMMUTE_SWAP");
        assertThat(plan.at("/grid/source").asText()).isEqualTo("FALLBACK");
        send("GET", "/api/v1/plan/today", null, null).andExpect(status().isUnauthorized());
    }

    @Test
    void mealSwapAppearsAfterBeefWithSavingFromFactors() throws Exception {
        String token = userWithBeef();
        JsonNode card = null;
        for (JsonNode c : plan(token).get("cards")) {
            if (c.get("key").asText().equals("MEAL_SWAP")) {
                card = c;
            }
        }
        assertThat(card).isNotNull();
        assertThat(card.get("category").asText()).isEqualTo("DIET");
        assertThat(card.get("slot").asText()).isEqualTo("MIDDAY");
        // DE user: ifeu meal with beef 1.86 − vegetarian meal 0.935 (V9 factors); low = high × 0.7.
        assertThat(card.at("/saving/highKg").decimalValue()).isEqualByComparingTo("0.92");
        assertThat(card.at("/saving/lowKg").decimalValue()).isEqualByComparingTo("0.65");
        assertThat(card.at("/saving/per").asText()).isEqualTo("TODAY");
        assertThat(card.get("whyNow").asText()).contains("3 times");
        assertThat(card.get("status").asText()).isEqualTo("NEW");
    }

    @Test
    void atMostOneCardPerCategory() throws Exception {
        // A clean window from now on, so the energy card qualifies too.
        Instant start = Instant.now().truncatedTo(ChronoUnit.HOURS);
        StringBuilder t = new StringBuilder();
        StringBuilder s = new StringBuilder();
        StringBuilder g = new StringBuilder();
        for (int i = 0; i < 24; i++) {
            String sep = i == 0 ? "" : ",";
            t.append(sep).append(start.getEpochSecond() + 900L * i);
            s.append(sep).append(i >= 4 && i < 12 ? 80 : 20);
            g.append(sep).append(i >= 4 && i < 12 ? 2 : 0);
        }
        doReturn("{\"unix_seconds\":[" + t + "],\"share\":[" + s + "],\"signal\":[" + g
                + "],\"substitute\":false}").when(fetcher).fetch();

        String token = userWithBeef();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        create(token, activity("TRANSPORT", "CAR_PETROL", 12, today));
        create(token, activity("TRANSPORT", "CAR_EV", 30, today));
        create(token, activity("TRANSPORT", "FLIGHT_SHORT", 800, today.minusDays(100)));

        JsonNode plan = plan(token);
        assertThat(plan.at("/grid/source").asText()).isEqualTo("ENERGY_CHARTS");
        assertThat(plan.at("/grid/bestWindow/avgShare").decimalValue()).isEqualByComparingTo("80.0");
        JsonNode cards = plan.get("cards");
        assertThat(cards.size()).isEqualTo(3);
        Set<String> categories = new HashSet<>();
        cards.forEach(c -> categories.add(c.get("category").asText()));
        assertThat(categories).containsExactlyInAnyOrder("DIET", "TRANSPORT", "ENERGY");
        assertThat(keys(plan)).contains("MEAL_SWAP", "SHIFT_APPLIANCE");
        // Ranked best first.
        assertThat(cards.get(0).get("score").asDouble()).isGreaterThanOrEqualTo(cards.get(2).get("score").asDouble());
    }

    @Test
    void dismissedCardRestsThreeDays() throws Exception {
        String token = userWithBeef();
        feedback(token, "MEAL_SWAP", "DISMISSED");
        assertThat(keys(plan(token))).doesNotContain("MEAL_SWAP");
        clock.offset = Duration.ofDays(2);
        assertThat(keys(plan(token))).doesNotContain("MEAL_SWAP");
        clock.offset = Duration.ofDays(3);
        assertThat(keys(plan(token))).contains("MEAL_SWAP");
    }

    @Test
    void snoozedCardReturnsTomorrowAndAdoptedKeepsIfThen() throws Exception {
        String token = userWithBeef();
        feedback(token, "MEAL_SWAP", "SNOOZED");
        assertThat(keys(plan(token))).doesNotContain("MEAL_SWAP");
        clock.offset = Duration.ofDays(1);
        assertThat(keys(plan(token))).contains("MEAL_SWAP");

        send("POST", "/api/v1/plan/cards/MEAL_SWAP/feedback", token,
                Map.of("event", "ADOPTED", "ifThen", "If I am at the canteen, then I take the lentils."))
                .andExpect(status().isNoContent());
        JsonNode card = plan(token).get("cards").findParents("key").stream()
                .filter(c -> c.get("key").asText().equals("MEAL_SWAP")).findFirst().orElseThrow();
        assertThat(card.get("status").asText()).isEqualTo("ADOPTED");
        assertThat(card.get("ifThen").asText()).isEqualTo("If I am at the canteen, then I take the lentils.");
    }

    @Test
    void feedbackIsValidated() throws Exception {
        String token = newUserToken();
        send("POST", "/api/v1/plan/cards/MEAL_SWAP/feedback", token, Map.of("event", "LOVED"))
                .andExpect(status().isBadRequest());
        send("POST", "/api/v1/plan/cards/MEAL_SWAP/feedback", token, Map.of())
                .andExpect(status().isUnprocessableEntity()); // missing field: bean validation, as elsewhere
        send("POST", "/api/v1/plan/cards/MEAL_SWAP/feedback", token, Map.of("event", "DONE", "ifThen", "x".repeat(201)))
                .andExpect(status().isBadRequest());
        send("POST", "/api/v1/plan/cards/NO_SUCH_CARD/feedback", token, Map.of("event", "DONE"))
                .andExpect(status().isNotFound());
        send("POST", "/api/v1/plan/cards/MEAL_SWAP/feedback", null, Map.of("event", "DONE"))
                .andExpect(status().isUnauthorized());
        feedback(token, "MEAL_SWAP", "DONE");
    }

    // ---- grid --------------------------------------------------------------------------------

    @Test
    void gridFallsBackWhenTheFetchThrows() throws Exception {
        String token = newUserToken();
        send("GET", "/api/v1/grid/signal", token, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("FALLBACK"))
                .andExpect(jsonPath("$.points").isEmpty())
                .andExpect(jsonPath("$.bestWindow").doesNotExist())
                .andExpect(jsonPath("$.attribution").value("Energy-Charts, Fraunhofer ISE"));
        send("GET", "/api/v1/grid/signal", null, null).andExpect(status().isUnauthorized());
    }
}
