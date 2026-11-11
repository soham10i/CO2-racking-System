package com.co2tracker.portability;

import java.util.ArrayList;
import java.util.List;

/** Minimal RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF line ends. */
final class Csv {

    private Csv() {
    }

    /** One parsed record and the 1-based line it starts on, for error messages. */
    record Row(int line, List<String> cells) {
    }

    static String line(List<String> cells) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(cell(cells.get(i)));
        }
        return sb.append("\r\n").toString();
    }

    /**
     * Quotes when needed. A text cell starting with = + - @ is prefixed with an apostrophe so spreadsheet apps do
     * not run it as a formula (CSV injection); numbers are written by the caller and never start that way except
     * as a minus sign, which no exported number has.
     */
    static String cell(String v) {
        if (v == null) {
            return "";
        }
        String s = !v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0 ? "'" + v : v;
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    static List<Row> parse(String text) {
        return parse(text, ',');
    }

    /** German spreadsheet exports use ';' because ',' is their decimal mark; the first line decides. */
    static char sniffDelimiter(String text) {
        int end = text.indexOf('\n');
        String first = end < 0 ? text : text.substring(0, end);
        return first.chars().filter(c -> c == ';').count() > first.chars().filter(c -> c == ',').count() ? ';' : ',';
    }

    static List<Row> parse(String text, char delimiter) {
        List<Row> rows = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        int line = 1;
        int rowStart = 1;
        // A leading byte-order mark (Excel's "CSV UTF-8") is not part of the first header.
        int i = text.startsWith("﻿") ? 1 : 0;
        for (; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"' && i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else if (c == '"') {
                    quoted = false;
                } else {
                    if (c == '\n') {
                        line++;
                    }
                    cur.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == delimiter) {
                cells.add(cur.toString());
                cur.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                cells.add(cur.toString());
                cur.setLength(0);
                addIfNotBlank(rows, rowStart, cells);
                cells = new ArrayList<>();
                line++;
                rowStart = line;
            } else {
                cur.append(c);
            }
        }
        cells.add(cur.toString());
        addIfNotBlank(rows, rowStart, cells);
        return rows;
    }

    private static void addIfNotBlank(List<Row> rows, int line, List<String> cells) {
        if (cells.stream().anyMatch(c -> !c.isBlank())) {
            rows.add(new Row(line, List.copyOf(cells)));
        }
    }
}
