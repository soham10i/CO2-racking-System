package com.co2tracker.analytics;

import com.co2tracker.emission.Category;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

/** JDBC access to the daily_emission read model: a few narrow, index-friendly queries and one atomic upsert. */
@Repository
public class DailyEmissionRepository {

    public record DayRow(LocalDate day, Category category, BigDecimal kgCo2e) {
    }

    private static final String UPSERT_POSTGRES = """
            INSERT INTO daily_emission (user_id, occurred_on, category, kg_co2e) VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, occurred_on, category)
            DO UPDATE SET kg_co2e = daily_emission.kg_co2e + EXCLUDED.kg_co2e
            """;

    /** H2 (tests) has no ON CONFLICT ... DO UPDATE; standard MERGE is equivalent and equally atomic. */
    private static final String UPSERT_STANDARD = """
            MERGE INTO daily_emission t
            USING (VALUES (CAST(? AS UUID), CAST(? AS DATE), CAST(? AS VARCHAR(16)), CAST(? AS NUMERIC(16, 3))))
                AS s (user_id, occurred_on, category, kg)
            ON t.user_id = s.user_id AND t.occurred_on = s.occurred_on AND t.category = s.category
            WHEN MATCHED THEN UPDATE SET kg_co2e = t.kg_co2e + s.kg
            WHEN NOT MATCHED THEN INSERT (user_id, occurred_on, category, kg_co2e)
                VALUES (s.user_id, s.occurred_on, s.category, s.kg)
            """;

    private final JdbcTemplate jdbc;
    private final String upsert;

    public DailyEmissionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        String product = jdbc.execute((ConnectionCallback<String>) c -> c.getMetaData().getDatabaseProductName());
        this.upsert = "PostgreSQL".equalsIgnoreCase(product) ? UPSERT_POSTGRES : UPSERT_STANDARD;
    }

    public void applyDelta(UUID userId, LocalDate day, Category category, BigDecimal deltaKg) {
        jdbc.update(upsert, userId, day, category.name(), deltaKg);
        // Keep the table sparse: a key whose activities were all removed disappears.
        jdbc.update("DELETE FROM daily_emission WHERE user_id = ? AND occurred_on = ? AND category = ? AND kg_co2e = 0",
                userId, day, category.name());
    }

    public BigDecimal total(UUID userId, LocalDate from, LocalDate to) {
        BigDecimal v = jdbc.queryForObject("""
                SELECT SUM(kg_co2e) FROM daily_emission WHERE user_id = ? AND occurred_on BETWEEN ? AND ?
                """, BigDecimal.class, userId, from, to);
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Totals per category with every category present (zero when nothing was logged). */
    public Map<Category, BigDecimal> byCategory(UUID userId, LocalDate from, LocalDate to) {
        Map<Category, BigDecimal> totals = zeroes();
        jdbc.query("""
                SELECT category, SUM(kg_co2e) AS kg FROM daily_emission
                WHERE user_id = ? AND occurred_on BETWEEN ? AND ? GROUP BY category
                """, (RowCallbackHandler) rs -> totals.put(Category.valueOf(rs.getString("category")),
                rs.getBigDecimal("kg")), userId, from, to);
        return totals;
    }

    public List<DayRow> days(UUID userId, LocalDate from, LocalDate to) {
        return jdbc.query("""
                SELECT occurred_on, category, kg_co2e FROM daily_emission
                WHERE user_id = ? AND occurred_on BETWEEN ? AND ? ORDER BY occurred_on
                """, (rs, i) -> new DayRow(rs.getObject("occurred_on", LocalDate.class),
                Category.valueOf(rs.getString("category")), rs.getBigDecimal("kg_co2e")), userId, from, to);
    }

    static Map<Category, BigDecimal> zeroes() {
        Map<Category, BigDecimal> m = new EnumMap<>(Category.class);
        for (Category c : Category.values()) {
            m.put(c, BigDecimal.ZERO);
        }
        return m;
    }
}
