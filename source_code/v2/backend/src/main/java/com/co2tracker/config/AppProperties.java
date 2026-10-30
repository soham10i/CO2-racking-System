package com.co2tracker.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(String frontendUrl, String mailFrom, Security security) {

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
}
