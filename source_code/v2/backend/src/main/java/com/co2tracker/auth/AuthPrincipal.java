package com.co2tracker.auth;

import java.util.UUID;

/** Identity taken exclusively from the verified access token. */
public record AuthPrincipal(UUID userId, String role) {
}
