package com.co2tracker.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** OAuth client of type "Web application" from Google Cloud Console. Empty = Google sign-in switched off. */
@ConfigurationProperties("app.google")
public record GoogleProperties(String clientId) {

    public boolean enabled() {
        return clientId != null && !clientId.isBlank();
    }
}
