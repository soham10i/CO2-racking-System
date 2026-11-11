package com.co2tracker.household;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.household.HouseholdDtos.CreateRequest;
import com.co2tracker.household.HouseholdDtos.HouseholdResponse;
import com.co2tracker.household.HouseholdDtos.InviteResponse;
import com.co2tracker.household.HouseholdDtos.JoinRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/household")
public class HouseholdController {

    private final HouseholdService service;

    public HouseholdController(HouseholdService service) {
        this.service = service;
    }

    /** 204 when the user is not in a household. */
    @GetMapping
    public ResponseEntity<HouseholdResponse> mine(@AuthenticationPrincipal AuthPrincipal p) {
        return service.mine(p.userId()).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HouseholdResponse create(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody CreateRequest req) {
        return service.create(p.userId(), req.name());
    }

    @PatchMapping
    public HouseholdResponse rename(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody CreateRequest req) {
        return service.rename(p.userId(), req.name());
    }

    @PostMapping("/invites")
    @ResponseStatus(HttpStatus.CREATED)
    public InviteResponse invite(@AuthenticationPrincipal AuthPrincipal p) {
        return service.invite(p.userId());
    }

    @PostMapping("/join")
    public HouseholdResponse join(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody JoinRequest req) {
        return service.join(p.userId(), req.code());
    }

    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@AuthenticationPrincipal AuthPrincipal p) {
        service.leave(p.userId());
    }
}
