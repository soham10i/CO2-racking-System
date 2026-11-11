package com.co2tracker.plan;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.plan.PlanDtos.FeedbackRequest;
import com.co2tracker.plan.PlanDtos.PlanResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/plan")
public class PlanController {

    private final PlanService plan;

    public PlanController(PlanService plan) {
        this.plan = plan;
    }

    @GetMapping("/today")
    public PlanResponse today(@AuthenticationPrincipal AuthPrincipal p) {
        return plan.today(p.userId());
    }

    /** Feedback is always recorded for the caller; there is no way to address another user's plan. */
    @PostMapping("/cards/{key}/feedback")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void feedback(@AuthenticationPrincipal AuthPrincipal p, @PathVariable String key,
            @Valid @RequestBody FeedbackRequest req) {
        plan.feedback(p.userId(), key, req.event(), req.ifThen());
    }
}
