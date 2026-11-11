package com.co2tracker.portability;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * Reads smart-meter and utility-portal exports into one kWh figure per day. A file has either a consumption
 * column (per interval, summed per day) or a cumulative meter-reading column (differences between days, booked
 * on the later day). German headers, ';' as delimiter and decimal commas are accepted.
 */
final class MeterCsv {

    private MeterCsv() {
    }

    /** One day to book, or a problem with a source line (then {@code kwh} is null). */
    record Day(int line, LocalDate date, BigDecimal kwh, String error) {
    }

    private static final List<String> DATE = List.of("date", "datum", "day", "tag", "timestamp", "zeitstempel",
            "ablesedatum", "reading_date", "zeit", "time", "bis", "to", "end");
    private static final List<String> READING = List.of("reading", "meter_reading", "zählerstand", "zaehlerstand",
            "stand", "zählerstand_kwh", "zaehlerstand_kwh", "reading_kwh");
    private static final List<String> USAGE = List.of("consumption", "verbrauch", "kwh", "usage", "energy", "menge",
            "verbrauch_kwh", "consumption_kwh", "energie", "wert", "value");
    private static final DateTimeFormatter GERMAN = DateTimeFormatter.ofPattern("d.M.uuuu");
    private static final DateTimeFormatter GERMAN_SHORT = DateTimeFormatter.ofPattern("d.M.uu");
    private static final Pattern NOT_NUMBER = Pattern.compile("[^0-9,.\\-]");

    static List<Day> read(String text) {
        List<Csv.Row> rows = Csv.parse(text, Csv.sniffDelimiter(text));
        if (rows.size() < 2) {
            throw new IllegalArgumentException("The file needs a header row and at least one reading");
        }
        List<String> header = rows.get(0).cells().stream().map(MeterCsv::normalise).toList();
        if (header.stream().anyMatch(h -> h.contains("m3") || h.contains("m³"))) {
            throw new IllegalArgumentException("This file is in cubic metres. Use the kWh figures from your bill "
                    + "(m³ × calorific value × Zustandszahl).");
        }
        int date = find(header, DATE);
        int reading = find(header, READING);
        int usage = reading >= 0 ? -1 : find(header, USAGE);
        if (date < 0 || (reading < 0 && usage < 0)) {
            throw new IllegalArgumentException("The header needs a date column (date or Datum) and either a meter "
                    + "reading (reading or Zählerstand) or a consumption column (consumption or Verbrauch), in kWh");
        }
        return reading >= 0 ? fromReadings(rows, date, reading) : fromUsage(rows, date, usage);
    }

    private static List<Day> fromUsage(List<Csv.Row> rows, int dateCol, int col) {
        Map<LocalDate, BigDecimal> perDay = new TreeMap<>();
        Map<LocalDate, Integer> firstLine = new TreeMap<>();
        List<Day> out = new ArrayList<>();
        for (Csv.Row row : rows.subList(1, rows.size())) {
            try {
                LocalDate d = date(cell(row, dateCol));
                BigDecimal kwh = number(cell(row, col));
                if (kwh.signum() < 0) {
                    throw new IllegalArgumentException("Consumption cannot be negative");
                }
                perDay.merge(d, kwh, BigDecimal::add);
                firstLine.putIfAbsent(d, row.line());
            } catch (IllegalArgumentException e) {
                out.add(new Day(row.line(), null, null, e.getMessage()));
            }
        }
        perDay.forEach((d, kwh) -> out.add(kwh.signum() == 0
                ? new Day(firstLine.get(d), d, null, "No consumption on this day")
                : new Day(firstLine.get(d), d, kwh, null)));
        return out;
    }

    /** The last reading of each day counts; the first day is the starting point and books nothing. */
    private static List<Day> fromReadings(List<Csv.Row> rows, int dateCol, int col) {
        Map<LocalDate, BigDecimal> lastOfDay = new TreeMap<>();
        Map<LocalDate, Integer> line = new TreeMap<>();
        List<Day> out = new ArrayList<>();
        for (Csv.Row row : rows.subList(1, rows.size())) {
            try {
                LocalDate d = date(cell(row, dateCol));
                lastOfDay.put(d, number(cell(row, col)));
                line.put(d, row.line());
            } catch (IllegalArgumentException e) {
                out.add(new Day(row.line(), null, null, e.getMessage()));
            }
        }
        BigDecimal previous = null;
        for (Map.Entry<LocalDate, BigDecimal> e : lastOfDay.entrySet()) {
            if (previous != null) {
                BigDecimal diff = e.getValue().subtract(previous);
                int l = line.get(e.getKey());
                if (diff.signum() < 0) {
                    out.add(new Day(l, e.getKey(), null, "The reading went down (new meter?). Import the readings "
                            + "of each meter separately"));
                } else if (diff.signum() == 0) {
                    out.add(new Day(l, e.getKey(), null, "No consumption since the previous reading"));
                } else {
                    out.add(new Day(l, e.getKey(), diff, null));
                }
            }
            previous = e.getValue();
        }
        return out;
    }

    private static int find(List<String> header, List<String> names) {
        for (String n : names) {
            int i = header.indexOf(n);
            if (i >= 0) {
                return i;
            }
        }
        return -1;
    }

    /** "Verbrauch (kWh)" → "verbrauch_kwh"; "Zählerstand in kWh" → "zählerstand_kwh". */
    private static String normalise(String h) {
        return h.strip().toLowerCase(Locale.ROOT)
                .replace("(", " ").replace(")", " ").replace("[", " ").replace("]", " ")
                .replace(" in ", " ").strip().replaceAll("\\s+", "_");
    }

    private static String cell(Csv.Row row, int i) {
        return i < row.cells().size() ? row.cells().get(i).strip() : "";
    }

    /** 2026-10-30, 30.10.2026 or 30.10.26, optionally followed by a time. */
    static LocalDate date(String raw) {
        String s = raw.split("[ T]")[0];
        try {
            if (s.contains("-")) {
                return LocalDate.parse(s);
            }
            return LocalDate.parse(s, s.length() > 8 ? GERMAN : GERMAN_SHORT);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Date must look like 2026-10-30 or 30.10.2026");
        }
    }

    /** 1.234,5 (German), 1,234.5 (English), 1234,5 or 1234.5; a trailing unit such as "kWh" is ignored. */
    static BigDecimal number(String raw) {
        String s = NOT_NUMBER.matcher(raw).replaceAll("");
        int comma = s.lastIndexOf(',');
        int dot = s.lastIndexOf('.');
        if (comma >= 0 && dot >= 0) {
            s = comma > dot ? s.replace(".", "").replace(',', '.') : s.replace(",", "");
        } else if (comma >= 0) {
            s = s.replace(',', '.');
        }
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("“" + raw + "” is not a number");
        }
    }
}
