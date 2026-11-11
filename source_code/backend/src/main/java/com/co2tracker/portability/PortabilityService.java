package com.co2tracker.portability;

import com.co2tracker.activity.ActivityDtos.ActivityRequest;
import com.co2tracker.activity.ActivityDtos.ActivityResponse;
import com.co2tracker.activity.ActivityDtos.EstimateResponse;
import com.co2tracker.activity.ActivityService;
import com.co2tracker.common.ApiException;
import com.co2tracker.emission.Category;
import com.co2tracker.insights.ActionDecisionRepository;
import com.co2tracker.insights.BaselineService;
import com.co2tracker.insights.GoalService;
import com.co2tracker.insights.InsightsDtos.BaselineResponse;
import com.co2tracker.template.TemplateService;
import com.co2tracker.user.UserService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Data portability (SRS AUTH-7, LOG-8): a full JSON export of the user's data, a CSV export of activities and a
 * CSV import that checks every row with the same rules as the log form before anything is saved.
 *
 * <p>Not transactional on purpose: each imported row is saved in its own transaction by {@link ActivityService},
 * so one bad row cannot roll back the others, and a failed check never poisons a surrounding transaction.
 */
@Service
public class PortabilityService {

    static final int MAX_ROWS = 5000;
    static final List<String> COLUMNS = List.of("date", "category", "subtype", "label", "quantity", "unit",
            "passengers", "kg_co2e", "factor_source", "note");

    private final ActivityService activities;
    private final TemplateService templates;
    private final UserService users;
    private final GoalService goals;
    private final BaselineService baseline;
    private final ActionDecisionRepository decisions;
    private final Validator validator;
    private final Clock clock;

    public PortabilityService(ActivityService activities, TemplateService templates, UserService users,
            GoalService goals, BaselineService baseline, ActionDecisionRepository decisions, Validator validator,
            Clock clock) {
        this.activities = activities;
        this.templates = templates;
        this.users = users;
        this.goals = goals;
        this.baseline = baseline;
        this.decisions = decisions;
        this.validator = validator;
        this.clock = clock;
    }

    // ---- export --------------------------------------------------------------------------------

    public record Decision(String actionKey, String status, LocalDate decidedOn, LocalDate snoozedUntil,
            BigDecimal expectedAnnualKg) {
    }

    public Map<String, Object> exportJson(UUID userId) {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("format", "co2-tracker-export/1");
        out.put("exportedAt", clock.instant());
        out.put("account", users.me(userId));
        out.put("monthlyBudget", goals.get(userId));
        out.put("baseline", baseline.get(userId).map(BaselineResponse::answers).orElse(null));
        out.put("activities", activities.all(userId));
        out.put("templates", templates.list(userId));
        out.put("actionDecisions", decisions.findByUserId(userId).stream()
                .map(d -> new Decision(d.getActionKey(), d.getStatus().name(), d.getDecidedOn(), d.getSnoozedUntil(),
                        d.getExpectedAnnualKg()))
                .toList());
        return out;
    }

    public String exportCsv(UUID userId) {
        StringBuilder sb = new StringBuilder(Csv.line(COLUMNS));
        for (ActivityResponse a : activities.all(userId)) {
            sb.append(Csv.line(List.of(a.occurredOn().toString(), a.category().name(), a.subtype(), a.label(),
                    a.quantity().stripTrailingZeros().toPlainString(), a.unit(), String.valueOf(a.passengers()),
                    a.kgCo2e().stripTrailingZeros().toPlainString(), a.factor() == null ? "" : a.factor().sourceName(),
                    a.note() == null ? "" : a.note())));
        }
        return sb.toString();
    }

    // ---- import --------------------------------------------------------------------------------

    public enum RowStatus { READY, DUPLICATE, ERROR, IMPORTED }

    public record ImportRow(int line, RowStatus status, String message, LocalDate date, String label,
            BigDecimal quantity, String unit, BigDecimal kgCo2e) {
    }

    public record ImportResponse(boolean dryRun, int ready, int duplicates, int errors, int imported,
            List<ImportRow> rows) {
    }

    /**
     * Columns are matched by header name, so the export's own file imports as is and extra columns are ignored.
     * Rows that match an existing entry (same date, type and quantity) are reported as duplicates and skipped.
     */
    public ImportResponse importCsv(UUID userId, String text, boolean dryRun) {
        List<Csv.Row> rows = Csv.parse(text == null ? "" : text);
        if (rows.isEmpty()) {
            throw ApiException.unprocessable("csv_empty", "The file has no rows");
        }
        if (rows.size() - 1 > MAX_ROWS) {
            throw ApiException.unprocessable("csv_too_large", "Import at most " + MAX_ROWS + " rows at a time");
        }
        Map<String, Integer> col = new HashMap<>();
        List<String> header = rows.get(0).cells();
        for (int i = 0; i < header.size(); i++) {
            col.putIfAbsent(header.get(i).strip().toLowerCase(Locale.ROOT).replace(' ', '_'), i);
        }
        for (String required : List.of("date", "category", "subtype", "quantity")) {
            if (!col.containsKey(required)) {
                throw ApiException.unprocessable("csv_missing_column",
                        "The header needs these columns: date, category, subtype, quantity (passengers and note "
                                + "are optional)");
            }
        }

        List<Candidate> candidates = new ArrayList<>();
        for (Csv.Row row : rows.subList(1, rows.size())) {
            try {
                candidates.add(new Candidate(row.line(), request(row, col), null));
            } catch (IllegalArgumentException e) {
                candidates.add(new Candidate(row.line(), null, e.getMessage()));
            }
        }
        return book(userId, candidates, dryRun);
    }

    /** A source line turned into a request, or the reason it could not be. */
    private record Candidate(int line, ActivityRequest req, String error) {
    }

    public static final Set<String> METER_SUBTYPES = Set.of("ELECTRICITY", "NATURAL_GAS",
            "DISTRICT_HEATING");

    /**
     * Smart-meter or utility-portal export: one entry per day with consumption, all of the chosen energy type.
     * Interval rows are summed per day; cumulative readings become the difference to the previous day.
     */
    public ImportResponse importMeter(UUID userId, String text, String subtype, boolean dryRun) {
        if (!METER_SUBTYPES.contains(subtype)) {
            throw ApiException.unprocessable("invalid_subtype", "Choose electricity, natural gas or district heating");
        }
        List<MeterCsv.Day> days;
        try {
            days = MeterCsv.read(text == null ? "" : text);
        } catch (IllegalArgumentException e) {
            throw ApiException.unprocessable("meter_format", e.getMessage());
        }
        if (days.size() > MAX_ROWS) {
            throw ApiException.unprocessable("csv_too_large", "Import at most " + MAX_ROWS + " days at a time");
        }
        List<Candidate> candidates = new ArrayList<>();
        for (MeterCsv.Day d : days) {
            if (d.error() != null) {
                candidates.add(new Candidate(d.line(), null, d.error()));
                continue;
            }
            ActivityRequest req = new ActivityRequest(Category.ENERGY, subtype,
                    d.kwh().setScale(3, RoundingMode.HALF_EVEN), d.date(), null, "Meter import", null, null);
            candidates.add(new Candidate(d.line(), req, null));
        }
        candidates.sort(Comparator.comparingInt(Candidate::line));
        return book(userId, candidates, dryRun);
    }

    /** Checks, de-duplicates and (unless dryRun) books the candidates; one bad row never stops the others. */
    private ImportResponse book(UUID userId, List<Candidate> candidates, boolean dryRun) {
        Set<String> seen = new HashSet<>();
        for (ActivityResponse a : activities.all(userId)) {
            seen.add(key(a.occurredOn(), a.subtype(), a.quantity()));
        }

        List<ImportRow> out = new ArrayList<>();
        int ready = 0;
        int dupes = 0;
        int errors = 0;
        int imported = 0;
        for (Candidate c : candidates) {
            ActivityRequest req = c.req();
            if (req == null) {
                out.add(new ImportRow(c.line(), RowStatus.ERROR, c.error(), null, null, null, null, null));
                errors++;
                continue;
            }
            EstimateResponse est;
            try {
                est = activities.check(userId, req);
            } catch (ApiException e) {
                out.add(new ImportRow(c.line(), RowStatus.ERROR, e.getMessage(), req.occurredOn(), null,
                        req.quantity(), null, null));
                errors++;
                continue;
            }
            // The key also catches repeated rows inside the same file.
            if (!seen.add(key(req.occurredOn(), req.subtype(), req.quantity()))) {
                out.add(new ImportRow(c.line(), RowStatus.DUPLICATE, "Already logged (same date, type and amount)",
                        req.occurredOn(), est.label(), req.quantity(), est.unit(), est.kgCo2e()));
                dupes++;
                continue;
            }
            if (dryRun) {
                out.add(new ImportRow(c.line(), RowStatus.READY, null, req.occurredOn(), est.label(), req.quantity(),
                        est.unit(), est.kgCo2e()));
                ready++;
                continue;
            }
            try {
                ActivityResponse a = activities.create(userId, req);
                out.add(new ImportRow(c.line(), RowStatus.IMPORTED, null, a.occurredOn(), a.label(), a.quantity(),
                        a.unit(), a.kgCo2e()));
                imported++;
            } catch (ApiException e) {
                out.add(new ImportRow(c.line(), RowStatus.ERROR, e.getMessage(), req.occurredOn(), null,
                        req.quantity(), null, null));
                errors++;
            }
        }
        return new ImportResponse(dryRun, ready, dupes, errors, imported, out);
    }

    private ActivityRequest request(Csv.Row row, Map<String, Integer> col) {
        String date = cell(row, col, "date");
        String category = cell(row, col, "category").toUpperCase(Locale.ROOT);
        String subtype = cell(row, col, "subtype").toUpperCase(Locale.ROOT);
        String quantity = cell(row, col, "quantity").replace(',', '.');
        String passengers = cell(row, col, "passengers");
        String note = cell(row, col, "note");
        // An exported note may carry the apostrophe that guards against spreadsheet formulas; drop it again.
        if (note.length() > 1 && note.charAt(0) == '\'' && "=+-@".indexOf(note.charAt(1)) >= 0) {
            note = note.substring(1);
        }
        LocalDate occurredOn;
        try {
            occurredOn = LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Date must look like 2026-10-30");
        }
        Category cat;
        try {
            cat = Category.valueOf(category);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown category “" + category + "”");
        }
        BigDecimal qty;
        try {
            qty = new BigDecimal(quantity);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Quantity must be a number");
        }
        Integer pax = null;
        if (!passengers.isBlank()) {
            try {
                pax = Integer.valueOf(passengers.strip());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Passengers must be a whole number");
            }
        }
        ActivityRequest req = new ActivityRequest(cat, subtype, qty, occurredOn, pax, note.isBlank() ? null : note,
                null, null);
        Set<ConstraintViolation<ActivityRequest>> problems = validator.validate(req);
        if (!problems.isEmpty()) {
            ConstraintViolation<ActivityRequest> v = problems.iterator().next();
            throw new IllegalArgumentException(v.getPropertyPath() + " " + v.getMessage());
        }
        return req;
    }

    private static String cell(Csv.Row row, Map<String, Integer> col, String name) {
        Integer i = col.get(name);
        return i == null || i >= row.cells().size() ? "" : row.cells().get(i).strip();
    }

    private static String key(LocalDate date, String subtype, BigDecimal quantity) {
        return date + "|" + subtype + "|" + quantity.stripTrailingZeros().toPlainString();
    }
}
