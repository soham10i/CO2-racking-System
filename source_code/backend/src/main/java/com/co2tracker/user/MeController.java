package com.co2tracker.user;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.user.UserDtos.DeleteAccountRequest;
import com.co2tracker.user.UserDtos.MeResponse;
import com.co2tracker.user.UserDtos.PreferencesRequest;
import com.co2tracker.user.UserDtos.ProfileDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Every handler derives the user from the token; no endpoint accepts a user id. */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final UserService users;

    public MeController(UserService users) {
        this.users = users;
    }

    @GetMapping
    public MeResponse me(@AuthenticationPrincipal AuthPrincipal p) {
        return users.me(p.userId());
    }

    @PutMapping("/profile")
    public MeResponse updateProfile(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody ProfileDto dto) {
        return users.updateProfile(p.userId(), dto);
    }

    @PatchMapping("/preferences")
    public MeResponse updatePreferences(@AuthenticationPrincipal AuthPrincipal p,
            @Valid @RequestBody PreferencesRequest req) {
        return users.updatePreferences(p.userId(), req);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody DeleteAccountRequest req) {
        users.deleteAccount(p.userId(), req.password());
    }
}
