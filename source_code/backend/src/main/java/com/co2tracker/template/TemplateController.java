package com.co2tracker.template;

import com.co2tracker.activity.ActivityDtos.ActivityResponse;
import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.template.TemplateDtos.LogRequest;
import com.co2tracker.template.TemplateDtos.TemplateRequest;
import com.co2tracker.template.TemplateDtos.TemplateResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/v1/templates")
public class TemplateController {

    private final TemplateService service;

    public TemplateController(TemplateService service) {
        this.service = service;
    }

    @GetMapping
    public List<TemplateResponse> list(@AuthenticationPrincipal AuthPrincipal p) {
        return service.list(p.userId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateResponse create(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody TemplateRequest req) {
        return service.create(p.userId(), req);
    }

    @PutMapping("/{id}")
    public TemplateResponse update(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id,
            @Valid @RequestBody TemplateRequest req) {
        return service.update(p.userId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        service.delete(p.userId(), id);
    }

    /** One-tap quick add: books the template as an activity, today unless a date is given. */
    @PostMapping("/{id}/log")
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityResponse log(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id,
            @RequestBody(required = false) LogRequest req) {
        return service.log(p.userId(), id, req == null ? null : req.occurredOn());
    }
}
