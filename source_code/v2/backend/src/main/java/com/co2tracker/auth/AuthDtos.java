package com.co2tracker.auth;

import com.co2tracker.user.UserDtos.MeResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 12, max = 128) String password,
            @NotBlank @Size(max = 80) String displayName) {
    }

    public record LoginRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 128) String password) {
    }

    public record TokenRequest(@NotBlank @Size(max = 200) String token) {
    }

    public record ForgotPasswordRequest(@NotBlank @Email @Size(max = 254) String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Size(min = 12, max = 128) String newPassword) {
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(min = 12, max = 128) String newPassword) {
    }

    public record AuthResponse(String accessToken, long expiresIn, MeResponse user) {
    }
}
