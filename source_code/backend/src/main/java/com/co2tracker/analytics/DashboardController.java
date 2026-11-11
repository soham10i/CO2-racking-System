package com.co2tracker.analytics;

import com.co2tracker.analytics.AnalyticsDtos.Benchmarks;
import com.co2tracker.analytics.AnalyticsDtos.Comparison;
import com.co2tracker.analytics.AnalyticsDtos.Summary;
import com.co2tracker.analytics.AnalyticsDtos.Trend;
import com.co2tracker.auth.AuthPrincipal;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only analytics for the signed-in user; all dates default to the user's local today. */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final AnalyticsService service;

    public DashboardController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public Summary summary(@AuthenticationPrincipal AuthPrincipal p,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate date) {
        return service.summary(p.userId(), date);
    }

    @GetMapping("/trend")
    public Trend trend(@AuthenticationPrincipal AuthPrincipal p,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to,
            @RequestParam(required = false) Granularity granularity) {
        return service.trend(p.userId(), from, to, granularity);
    }

    @GetMapping("/compare")
    public Comparison compare(@AuthenticationPrincipal AuthPrincipal p,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return service.compare(p.userId(), from, to);
    }

    @GetMapping("/benchmarks")
    public Benchmarks benchmarks(@AuthenticationPrincipal AuthPrincipal p) {
        return service.benchmarks(p.userId());
    }
}
