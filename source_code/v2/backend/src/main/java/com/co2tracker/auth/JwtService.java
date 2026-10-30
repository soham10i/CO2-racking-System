package com.co2tracker.auth;

import com.co2tracker.config.AppProperties;
import com.co2tracker.user.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey key;
    private final AppProperties props;

    public JwtService(AppProperties props) {
        byte[] secret = props.security().jwtSecret() == null
                ? new byte[0]
                : props.security().jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set and at least 32 bytes long");
        }
        this.key = Keys.hmacShaKeyFor(secret);
        this.props = props;
    }

    public String issueAccessToken(AppUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getId().toString())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.security().accessTokenTtl())))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public long accessTokenTtlSeconds() {
        return props.security().accessTokenTtl().toSeconds();
    }

    /** Returns empty for any invalid, expired or tampered token. */
    public Optional<AuthPrincipal> parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(new AuthPrincipal(UUID.fromString(claims.getSubject()), claims.get("role", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
