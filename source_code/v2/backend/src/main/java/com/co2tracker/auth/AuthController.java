package com.co2tracker.auth;

import com.co2tracker.auth.AuthDtos.AuthResponse;
import com.co2tracker.auth.AuthDtos.ChangePasswordRequest;
import com.co2tracker.auth.AuthDtos.ForgotPasswordRequest;
import com.co2tracker.auth.AuthDtos.LoginRequest;
import com.co2tracker.auth.AuthDtos.RegisterRequest;
import com.co2tracker.auth.AuthDtos.ResetPasswordRequest;
import com.co2tracker.auth.AuthDtos.TokenRequest;
import com.co2tracker.config.AppProperties;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "refresh_token";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final AuthService auth;
    private final AppProperties props;

    public AuthController(AuthService auth, AppProperties props) {
        this.auth = auth;
        this.props = props;
    }

    @PostMapping("/register")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.ACCEPTED)
    public void register(@Valid @RequestBody RegisterRequest req) {
        auth.register(req.email(), req.password(), req.displayName());
    }

    @PostMapping("/verify-email")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody TokenRequest req) {
        auth.verifyEmail(req.token());
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return withSession(auth.login(req.email(), req.password()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String token) {
        return withSession(auth.refresh(token));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String token) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(@AuthenticationPrincipal AuthPrincipal principal) {
        auth.logoutAll(principal.userId());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @PostMapping("/forgot-password")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.ACCEPTED)
    public void forgot(@Valid @RequestBody ForgotPasswordRequest req) {
        auth.forgotPassword(req.email());
    }

    @PostMapping("/reset-password")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@Valid @RequestBody ResetPasswordRequest req) {
        auth.resetPassword(req.token(), req.newPassword());
    }

    @PostMapping("/change-password")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.NO_CONTENT)
    public void change(@AuthenticationPrincipal AuthPrincipal principal, @Valid @RequestBody ChangePasswordRequest req) {
        auth.changePassword(principal.userId(), req.currentPassword(), req.newPassword());
    }

    private ResponseEntity<AuthResponse> withSession(AuthService.Session s) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(s.refreshToken(), props.security().refreshTokenTtl()).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new AuthResponse(s.accessToken(), s.expiresIn(), s.user()));
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(props.security().cookieSecure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
