package com.co2tracker.portability;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.portability.PortabilityService.ImportResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class PortabilityController {

    /** The file's text, sent as JSON so the access token stays in the Authorization header. */
    public record ImportRequest(@NotNull @Size(max = 1_000_000, message = "must be at most 1 MB") String csv,
            boolean dryRun) {
    }

    public record MeterImportRequest(@NotNull @Size(max = 1_000_000, message = "must be at most 1 MB") String csv,
            @NotNull String subtype, boolean dryRun) {
    }

    private final PortabilityService portability;

    public PortabilityController(PortabilityService portability) {
        this.portability = portability;
    }

    @GetMapping("/me/export")
    public ResponseEntity<Map<String, Object>> exportAll(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, attachment("json"))
                .body(portability.exportJson(p.userId()));
    }

    @GetMapping("/activities/export")
    public ResponseEntity<String> exportCsv(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, attachment("csv"))
                .body(portability.exportCsv(p.userId()));
    }

    /** dryRun=true checks every row and saves nothing; the UI shows that preview before importing. */
    @PostMapping("/activities/import")
    public ImportResponse importCsv(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody ImportRequest req) {
        return portability.importCsv(p.userId(), req.csv(), req.dryRun());
    }

    @PostMapping("/activities/import/meter")
    public ImportResponse importMeter(@AuthenticationPrincipal AuthPrincipal p,
            @Valid @RequestBody MeterImportRequest req) {
        return portability.importMeter(p.userId(), req.csv(), req.subtype(), req.dryRun());
    }

    private static String attachment(String ext) {
        return "attachment; filename=\"co2-tracker-" + LocalDate.now() + "." + ext + "\"";
    }
}
