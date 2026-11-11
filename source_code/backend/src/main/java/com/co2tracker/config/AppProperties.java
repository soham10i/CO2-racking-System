package com.co2tracker.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(String frontendUrl, String mailFrom, Security security, Push push,
        List<String> adminEmails) {

    /** Whether the address is listed in APP_ADMIN_EMAILS (compared case-insensitively). */
    public boolean isAdminEmail(String email) {
        return adminEmails != null && email != null
                && adminEmails.stream().map(String::strip).anyMatch(a -> !a.isEmpty() && a.equalsIgnoreCase(email));
    }

    public record Security(
            String jwtSecret,
            Duration accessTokenTtl,
            Duration refreshTokenTtl,
            Duration verificationTokenTtl,
            Duration resetTokenTtl,
            boolean cookieSecure,
            int maxFailedLogins,
            Duration lockoutDuration) {
    }

    /**
     * Web push (VAPID). Push is off unless both keys are set. Keys are base64url: the 65-byte uncompressed public
     * point and the 32-byte private scalar (the format `npx web-push generate-vapid-keys` prints).
     */
    public record Push(String publicKey, String privateKey, String subject, List<String> allowedHosts) {

        public boolean enabled() {
            return publicKey != null && !publicKey.isBlank() && privateKey != null && !privateKey.isBlank();
        }
    }
}
