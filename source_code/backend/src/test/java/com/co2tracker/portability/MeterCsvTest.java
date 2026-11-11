package com.co2tracker.portability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class MeterCsvTest {

    @Test
    void germanReadingsBecomeDailyDifferences() {
        String csv = """
                Datum;Zählerstand (kWh)
                01.10.2026;12.345,5
                02.10.2026;12.355,0
                03.10.2026 23:45;12.367,25
                """;
        List<MeterCsv.Day> days = MeterCsv.read(csv);
        assertThat(days).hasSize(2);
        assertThat(days.get(0).date()).isEqualTo(LocalDate.of(2026, 10, 2));
        assertThat(days.get(0).kwh()).isEqualByComparingTo("9.5");
        assertThat(days.get(1).kwh()).isEqualByComparingTo("12.25");
    }

    @Test
    void intervalConsumptionIsSummedPerDay() {
        String csv = """
                timestamp,consumption_kwh
                2026-10-01T00:00,0.25
                2026-10-01T00:15,0.75
                2026-10-02T00:00,1.5
                """;
        List<MeterCsv.Day> days = MeterCsv.read(csv);
        assertThat(days).extracting(MeterCsv.Day::kwh).usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("1.00"), new BigDecimal("1.5"));
    }

    @Test
    void problemsAreReportedPerLine() {
        String csv = """
                Datum;Zählerstand
                01.10.2026;100
                kaputt;110
                03.10.2026;90
                """;
        List<MeterCsv.Day> days = MeterCsv.read(csv);
        assertThat(days).anyMatch(d -> d.line() == 3 && d.error().contains("Date"));
        assertThat(days).anyMatch(d -> d.date() != null && d.error() != null && d.error().contains("went down"));
    }

    @Test
    void numbersInBothNotations() {
        assertThat(MeterCsv.number("1.234,5")).isEqualByComparingTo("1234.5");
        assertThat(MeterCsv.number("1,234.5")).isEqualByComparingTo("1234.5");
        assertThat(MeterCsv.number("7,25 kWh")).isEqualByComparingTo("7.25");
        assertThat(MeterCsv.date("30.10.26")).isEqualTo(LocalDate.of(2026, 10, 30));
    }

    @Test
    void cubicMetresAndMissingColumnsAreRejected() {
        assertThatThrownBy(() -> MeterCsv.read("Datum;Zählerstand (m³)\n01.10.2026;5\n"))
                .hasMessageContaining("cubic metres");
        assertThatThrownBy(() -> MeterCsv.read("foo,bar\n1,2\n")).hasMessageContaining("header needs");
    }
}
