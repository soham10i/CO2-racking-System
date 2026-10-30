package com.co2tracker.insights;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.insights.InsightsDtos.ActionsResponse;
import com.co2tracker.insights.InsightsDtos.BaselineAnswers;
import com.co2tracker.insights.InsightsDtos.BaselineResponse;
import com.co2tracker.insights.InsightsDtos.GoalRequest;
import com.co2tracker.insights.InsightsDtos.GoalResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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

    public InsightsController(GoalService goals, BaselineService baseline, ActionsService actions) {
        this.goals = goals;
        this.baseline = baseline;
        this.actions = actions;
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
}
