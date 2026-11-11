package com.co2tracker.auth;

import com.co2tracker.common.ApiException;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Length-first policy (NIST 800-63B): min 12 chars, no composition rules, reject trivially common passwords. */
@Component
public class PasswordPolicy {

    private static final Set<String> COMMON = Set.of(
            "password1234", "passwordpassword", "123456789012", "qwertyuiop12", "qwertyqwerty",
            "iloveyou1234", "letmein12345", "welcome12345", "admin1234567", "co2tracker123");

    public void check(String password, String email) {
        if (password == null || password.length() < 12 || password.length() > 128) {
            throw ApiException.unprocessable("weak_password", "Password must be 12 to 128 characters");
        }
        String lower = password.toLowerCase(Locale.ROOT);
        if (COMMON.contains(lower) || (email != null && lower.contains(email.toLowerCase(Locale.ROOT)))
                || lower.chars().distinct().count() < 5) {
            throw ApiException.unprocessable("weak_password", "Password is too easy to guess");
        }
    }
}
