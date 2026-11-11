package com.co2tracker.auth;

import com.co2tracker.common.ApiException;
import java.util.List;
import java.util.Set;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Checks a Google ID token (the "credential" from Sign in with Google): RS256 signature against Google's
 * published keys, issuer, audience = our client id, expiry, and a verified email. Nothing in the token is
 * trusted before all of that passes.
 */
@Component
public class GoogleTokenVerifier {

    public record GoogleIdentity(String subject, String email, String name) {
    }

    private static final String JWKS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    private final GoogleProperties props;
    private volatile NimbusJwtDecoder decoder;

    public GoogleTokenVerifier(GoogleProperties props) {
        this.props = props;
    }

    public GoogleIdentity verify(String credential) {
        if (!props.enabled()) {
            throw ApiException.notFound("Google sign-in is not enabled");
        }
        Jwt jwt;
        try {
            jwt = decoder().decode(credential);
        } catch (JwtException e) {
            throw ApiException.unauthorized("Google sign-in failed");
        }
        if (!Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")) || jwt.getClaimAsString("email") == null) {
            throw ApiException.unauthorized("Your Google account has no verified email");
        }
        return new GoogleIdentity(jwt.getSubject(), jwt.getClaimAsString("email"), jwt.getClaimAsString("name"));
    }

    private NimbusJwtDecoder decoder() {
        NimbusJwtDecoder d = decoder;
        if (d == null) {
            synchronized (this) {
                if (decoder == null) {
                    // Keys are cached by Nimbus and refetched when Google rotates them.
                    NimbusJwtDecoder created = NimbusJwtDecoder.withJwkSetUri(JWKS).build();
                    created.setJwtValidator(new DelegatingOAuth2TokenValidator<>(List.of(
                            new JwtTimestampValidator(),
                            jwt -> ISSUERS.contains(String.valueOf(jwt.getClaims().get("iss")))
                                    ? OAuth2TokenValidatorResult.success()
                                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_issuer")),
                            jwt -> jwt.getAudience() != null && jwt.getAudience().contains(props.clientId())
                                    ? OAuth2TokenValidatorResult.success()
                                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_audience")))));
                    decoder = created;
                }
                d = decoder;
            }
        }
        return d;
    }
}
