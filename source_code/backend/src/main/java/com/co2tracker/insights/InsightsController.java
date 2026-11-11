package com.co2tracker.insights;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.insights.InsightsDtos.ActionsResponse;
import com.co2tracker.insights.InsightsDtos.BaselineAnswers;
import com.co2tracker.insights.InsightsDtos.BaselineResponse;
import com.co2tracker.insights.InsightsDtos.DecisionRequest;
import com.co2tracker.insights.InsightsDtos.GoalRequest;
import com.co2tracker.insights.InsightsDtos.GoalResponse;
import com.co2tracker.insights.InsightsDtos.Scope2Response;
import com.co2tracker.insights.InsightsDtos.SupplierRequest;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class InsightsController {

    private final GoalService goals;
    private final BaselineService baseline;
    private final ActionsService actions;
    private final Scope2Service scope2;

    public InsightsController(GoalService goals, BaselineService baseline, ActionsService actions,
            Scope2Service scope2) {
        this.goals = goals;
        this.baseline = baseline;
        this.actions = actions;
        this.scope2 = scope2;
    }

    @GetMapping("/insights/scope2")
    public Scope2Response scope2(@AuthenticationPrincipal AuthPrincipal p,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate to) {
        return scope2.get(p.userId(), from, to);
    }

    /** {@code gramsPerKwh: null} clears the supplier factor. */
    @PutMapping("/insights/scope2/supplier")
    public Scope2Response setSupplier(@AuthenticationPrincipal AuthPrincipal p,
            @Valid @RequestBody SupplierRequest req) {
        return scope2.setSupplier(p.userId(), req.gramsPerKwh());
    }

    @GetMapping("/goals")
    public GoalResponse goal(@AuthenticationPrincipal AuthPrincipal p) {
        return goals.get(p.userId());
    }

    @PutMapping("/goals")
    public GoalResponse setGoal(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody GoalRequest req) {
        return goals.set(p.userId(), req.monthlyBudgetKg());
    }

    /** 204 until the questionnaire has been saved once. */
    @GetMapping("/baseline")
    public ResponseEntity<BaselineResponse> baseline(@AuthenticationPrincipal AuthPrincipal p) {
        return baseline.get(p.userId()).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/baseline/estimate")
    public BaselineResponse preview(@AuthenticationPrincipal AuthPrincipal p,
            @Valid @RequestBody BaselineAnswers answers) {
        return baseline.preview(p.userId(), answers);
    }

    @PutMapping("/baseline")
    public BaselineResponse saveBaseline(@AuthenticationPrincipal AuthPrincipal p,
            @Valid @RequestBody BaselineAnswers answers) {
        return baseline.save(p.userId(), answers);
    }

    @PostMapping("/onboarding/skip")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void skipOnboarding(@AuthenticationPrincipal AuthPrincipal p) {
        baseline.skip(p.userId());
    }

    @GetMapping("/insights/actions")
    public ActionsResponse actions(@AuthenticationPrincipal AuthPrincipal p) {
        return actions.actions(p.userId());
    }

    /** Adopt, dismiss or snooze one action; returns the refreshed actions. */
    @PutMapping("/insights/actions/{key}/decision")
    public ActionsResponse decide(@AuthenticationPrincipal AuthPrincipal p, @PathVariable String key,
            @Valid @RequestBody DecisionRequest req) {
        return actions.decide(p.userId(), key, req.status(), req.snoozeDays());
    }

    /** Undo a decision; the action is suggested again if it still applies. */
    @DeleteMapping("/insights/actions/{key}/decision")
    public ActionsResponse resetDecision(@AuthenticationPrincipal AuthPrincipal p, @PathVariable String key) {
        return actions.reset(p.userId(), key);
    }
}
