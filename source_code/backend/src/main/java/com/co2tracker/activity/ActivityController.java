package com.co2tracker.activity;

import com.co2tracker.activity.ActivityDtos.ActivityRequest;
import com.co2tracker.activity.ActivityDtos.ActivityResponse;
import com.co2tracker.activity.ActivityDtos.CompareResponse;
import com.co2tracker.activity.ActivityDtos.EstimateRequest;
import com.co2tracker.activity.ActivityDtos.EstimateResponse;
import com.co2tracker.activity.ActivityDtos.FactorResponse;
import com.co2tracker.activity.ActivityDtos.PageResponse;
import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.emission.Category;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Every handler derives the user from the token; ids in the path are always checked against the owner. */
@RestController
@RequestMapping("/api/v1")
public class ActivityController {

    private final ActivityService service;

    public ActivityController(ActivityService service) {
        this.service = service;
    }

    @GetMapping("/emission-factors")
    public List<FactorResponse> factors(@AuthenticationPrincipal AuthPrincipal p,
            @RequestParam(required = false) Category category) {
        return service.factors(p.userId(), category);
    }

    /** Authenticated for now; becomes public once per-IP rate limiting exists (see README). */
    @PostMapping("/calculator/estimate")
    public EstimateResponse estimate(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody EstimateRequest req) {
        return service.estimate(p.userId(), req);
    }

    /** Same body and checks as an estimate; nothing is logged (docs/11 section 3). */
    @PostMapping("/calculator/compare")
    public CompareResponse compare(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody EstimateRequest req) {
        return service.compare(p.userId(), req);
    }

    @PostMapping("/activities")
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityResponse create(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody ActivityRequest req) {
        return service.create(p.userId(), req);
    }

    @GetMapping("/activities")
    public PageResponse<ActivityResponse> list(@AuthenticationPrincipal AuthPrincipal p,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Category category,
            @RequestParam(required = false) String subtype,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(p.userId(), from, to, category, subtype, page, size);
    }

    @GetMapping("/activities/{id}")
    public ActivityResponse get(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        return service.get(p.userId(), id);
    }

    @PutMapping("/activities/{id}")
    public ActivityResponse update(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id,
            @Valid @RequestBody ActivityRequest req) {
        return service.update(p.userId(), id, req);
    }

    @DeleteMapping("/activities/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        service.delete(p.userId(), id);
    }
}
