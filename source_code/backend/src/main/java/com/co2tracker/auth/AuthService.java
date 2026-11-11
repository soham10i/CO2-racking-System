package com.co2tracker.auth;

import com.co2tracker.auth.VerificationToken.Purpose;
import com.co2tracker.common.ApiException;
import com.co2tracker.common.TokenUtil;
import com.co2tracker.config.AppProperties;
import com.co2tracker.user.AppUser;
import com.co2tracker.user.ProfileEnums.Role;
import com.co2tracker.user.ProfileEnums.UserStatus;
import com.co2tracker.user.UserDtos.MeResponse;
import com.co2tracker.user.UserProfile;
import com.co2tracker.user.UserProfileRepository;
import com.co2tracker.user.UserRepository;
import com.co2tracker.user.UserService;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    public record Session(String accessToken, long expiresIn, String refreshToken, MeResponse user) {
    }

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final RefreshTokenRepository refreshTokens;
    private final VerificationTokenRepository verificationTokens;
    private final PasswordEncoder encoder;
    private final PasswordPolicy passwordPolicy;
    private final JwtService jwt;
    private final MailService mail;
    private final AppProperties props;
    private final String dummyHash;

    public AuthService(UserRepository users, UserProfileRepository profiles, RefreshTokenRepository refreshTokens,
            VerificationTokenRepository verificationTokens, PasswordEncoder encoder, PasswordPolicy passwordPolicy,
            JwtService jwt, MailService mail, AppProperties props) {
        this.users = users;
        this.profiles = profiles;
        this.refreshTokens = refreshTokens;
        this.verificationTokens = verificationTokens;
        this.encoder = encoder;
        this.passwordPolicy = passwordPolicy;
        this.jwt = jwt;
        this.mail = mail;
        this.props = props;
        // Compared against when the email is unknown so response time does not reveal account existence.
        this.dummyHash = encoder.encode("timing-equaliser-not-a-real-password");
    }

    /** Always succeeds from the caller's view, whether or not the email is already registered. */
    @Transactional
    public void register(String rawEmail, String password, String displayName, String locale) {
        String email = normalise(rawEmail);
        passwordPolicy.check(password, email);
        if (users.existsByEmail(email)) {
            return;
        }
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(password));
        user.setRole(Role.USER);
        user.setStatus(UserStatus.PENDING);
        user = users.saveAndFlush(user);

        UserProfile profile = new UserProfile();
        profile.setUserId(user.getId());
        profile.setDisplayName(displayName.trim());
        if (locale != null) {
            profile.setLocale(locale);
        }
        profiles.save(profile);

        mail.sendVerification(email, issueToken(user.getId(), Purpose.EMAIL_VERIFY,
                props.security().verificationTokenTtl()));
    }

    @Transactional
    public void verifyEmail(String token) {
        VerificationToken vt = consume(token, Purpose.EMAIL_VERIFY);
        AppUser user = users.findById(vt.getUserId()).orElseThrow(this::invalidToken);
        if (user.getStatus() == UserStatus.PENDING) {
            user.setStatus(UserStatus.ACTIVE);
            user.setUpdatedAt(Instant.now());
        }
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Session login(String rawEmail, String password) {
        AppUser user = users.findByEmail(normalise(rawEmail)).orElse(null);
        if (user == null) {
            encoder.matches(password, dummyHash);
            throw badCredentials();
        }
        Instant now = Instant.now();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw ApiException.tooManyRequests("Too many failed attempts. Try again later.");
        }
        if (user.getPasswordHash() == null || !encoder.matches(password, user.getPasswordHash())) {
            if (user.getPasswordHash() == null) {
                encoder.matches(password, dummyHash);
            }
            int failures = user.getFailedLogins() + 1;
            user.setFailedLogins(failures);
            if (failures >= props.security().maxFailedLogins()) {
                user.setLockedUntil(now.plus(props.security().lockoutDuration()));
                user.setFailedLogins(0);
            }
            throw badCredentials();
        }
        user.setFailedLogins(0);
        user.setLockedUntil(null);
        if (user.getStatus() == UserStatus.PENDING) {
            throw ApiException.forbidden("email_not_verified", "Please confirm your email first");
        }
        if (user.getStatus() == UserStatus.DISABLED) {
            throw ApiException.forbidden("account_disabled", "This account is disabled");
        }
        return openSession(user, UUID.randomUUID());
    }

    /**
     * Sign in with Google (identity already verified by {@link GoogleTokenVerifier}). Looks the account up by
     * Google's stable id first, then by verified email. Linking to an existing account that never confirmed
     * its email removes its password and sessions: whoever registered it could not prove they own the
     * address, so they must not keep a way in (account pre-hijacking).
     */
    @Transactional
    public Session loginWithGoogle(GoogleTokenVerifier.GoogleIdentity id) {
        String email = normalise(id.email());
        AppUser user = users.findByGoogleSub(id.subject()).orElse(null);
        if (user == null) {
            user = users.findByEmail(email).orElse(null);
            if (user != null) {
                if (user.getGoogleSub() != null) {
                    // The address belongs to a different Google account than the one already linked.
                    throw ApiException.forbidden("google_account_mismatch",
                            "This email is linked to a different Google account");
                }
                if (user.getStatus() == UserStatus.PENDING) {
                    user.setPasswordHash(null);
                    user.setStatus(UserStatus.ACTIVE);
                    refreshTokens.revokeAllForUser(user.getId(), Instant.now());
                }
                user.setGoogleSub(id.subject());
                user.setUpdatedAt(Instant.now());
            } else {
                user = createGoogleUser(id, email);
            }
        }
        if (user.getStatus() == UserStatus.DISABLED) {
            throw ApiException.forbidden("account_disabled", "This account is disabled");
        }
        user.setFailedLogins(0);
        user.setLockedUntil(null);
        return openSession(user, UUID.randomUUID());
    }

    private AppUser createGoogleUser(GoogleTokenVerifier.GoogleIdentity id, String email) {
        AppUser user = new AppUser();
        user.setEmail(email);
        user.setGoogleSub(id.subject());
        user.setRole(Role.USER);
        user.setStatus(UserStatus.ACTIVE);
        user = users.saveAndFlush(user);

        UserProfile profile = new UserProfile();
        profile.setUserId(user.getId());
        String name = id.name() == null || id.name().isBlank() ? email.substring(0, email.indexOf('@')) : id.name();
        profile.setDisplayName(name.strip().length() > 80 ? name.strip().substring(0, 80) : name.strip());
        profiles.save(profile);
        return user;
    }

    /** Rotates the refresh token. Presenting an already-used token revokes the whole family (theft signal). */
    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.unauthorized("Not signed in");
        }
        RefreshToken current = refreshTokens.findByTokenHash(TokenUtil.sha256(rawToken))
                .orElseThrow(() -> ApiException.unauthorized("Session expired"));
        Instant now = Instant.now();
        if (current.getRevokedAt() != null) {
            refreshTokens.revokeFamily(current.getFamilyId(), now);
            throw ApiException.unauthorized("Session expired");
        }
        if (current.getExpiresAt().isBefore(now)) {
            throw ApiException.unauthorized("Session expired");
        }
        AppUser user = users.findById(current.getUserId()).orElseThrow(() -> ApiException.unauthorized("Session expired"));
        if (user.getStatus() != UserStatus.ACTIVE) {
            refreshTokens.revokeFamily(current.getFamilyId(), now);
            throw ApiException.unauthorized("Session expired");
        }
        current.setRevokedAt(now);
        refreshTokens.saveAndFlush(current);
        return openSession(user, current.getFamilyId());
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        refreshTokens.findByTokenHash(TokenUtil.sha256(rawToken))
                .ifPresent(t -> refreshTokens.revokeFamily(t.getFamilyId(), Instant.now()));
    }

    @Transactional
    public void logoutAll(UUID userId) {
        refreshTokens.revokeAllForUser(userId, Instant.now());
    }

    /** Silent when the email is unknown so the endpoint cannot be used to enumerate accounts. */
    @Transactional
    public void forgotPassword(String rawEmail) {
        users.findByEmail(normalise(rawEmail))
                .filter(u -> u.getStatus() != UserStatus.DISABLED)
                .ifPresent(u -> mail.sendPasswordReset(u.getEmail(),
                        issueToken(u.getId(), Purpose.PASSWORD_RESET, props.security().resetTokenTtl())));
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        VerificationToken vt = consume(token, Purpose.PASSWORD_RESET);
        AppUser user = users.findById(vt.getUserId()).orElseThrow(this::invalidToken);
        passwordPolicy.check(newPassword, user.getEmail());
        setPassword(user, newPassword);
        // Possession of the mailbox proves ownership, so a pending account is activated too.
        if (user.getStatus() == UserStatus.PENDING) {
            user.setStatus(UserStatus.ACTIVE);
        }
    }

    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        AppUser user = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("Account no longer exists"));
        if (user.getPasswordHash() == null) {
            throw ApiException.forbidden("no_password",
                    "This account signs in with Google. Use \"Forgot password\" to add a password.");
        }
        if (!encoder.matches(currentPassword, user.getPasswordHash())) {
            throw ApiException.forbidden("invalid_password", "Current password is incorrect");
        }
        passwordPolicy.check(newPassword, user.getEmail());
        setPassword(user, newPassword);
    }

    private void setPassword(AppUser user, String newPassword) {
        user.setPasswordHash(encoder.encode(newPassword));
        user.setFailedLogins(0);
        user.setLockedUntil(null);
        user.setUpdatedAt(Instant.now());
        refreshTokens.revokeAllForUser(user.getId(), Instant.now());
    }

    private Session openSession(AppUser user, UUID familyId) {
        // Admins are bootstrapped from configuration at sign-in, so no endpoint can grant the role.
        if (user.getRole() != Role.ADMIN && props.isAdminEmail(user.getEmail())) {
            user.setRole(Role.ADMIN);
            users.save(user);
        }
        String raw = TokenUtil.newToken();
        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setFamilyId(familyId);
        rt.setTokenHash(TokenUtil.sha256(raw));
        rt.setExpiresAt(Instant.now().plus(props.security().refreshTokenTtl()));
        refreshTokens.save(rt);
        UserProfile profile = profiles.findById(user.getId()).orElseThrow();
        return new Session(jwt.issueAccessToken(user), jwt.accessTokenTtlSeconds(), raw,
                UserService.toMe(user, profile));
    }

    private String issueToken(UUID userId, Purpose purpose, java.time.Duration ttl) {
        String raw = TokenUtil.newToken();
        VerificationToken vt = new VerificationToken();
        vt.setUserId(userId);
        vt.setPurpose(purpose);
        vt.setTokenHash(TokenUtil.sha256(raw));
        vt.setExpiresAt(Instant.now().plus(ttl));
        verificationTokens.save(vt);
        return raw;
    }

    private VerificationToken consume(String raw, Purpose purpose) {
        VerificationToken vt = verificationTokens.findByTokenHashAndPurpose(TokenUtil.sha256(raw), purpose)
                .orElseThrow(this::invalidToken);
        if (vt.getUsedAt() != null || vt.getExpiresAt().isBefore(Instant.now())) {
            throw invalidToken();
        }
        vt.setUsedAt(Instant.now());
        return vt;
    }

    private ApiException invalidToken() {
        return ApiException.badRequest("invalid_token", "This link is invalid or has expired");
    }

    private ApiException badCredentials() {
        return ApiException.unauthorized("Invalid email or password");
    }

    private static String normalise(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
