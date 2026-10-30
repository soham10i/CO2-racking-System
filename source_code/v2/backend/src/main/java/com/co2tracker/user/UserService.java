package com.co2tracker.user;

import com.co2tracker.auth.RefreshTokenRepository;
import com.co2tracker.common.ApiException;
import com.co2tracker.user.UserDtos.CarDto;
import com.co2tracker.user.UserDtos.MeResponse;
import com.co2tracker.user.UserDtos.PreferencesRequest;
import com.co2tracker.user.UserDtos.ProfileDto;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;

    public UserService(UserRepository users, UserProfileRepository profiles, RefreshTokenRepository refreshTokens,
            PasswordEncoder encoder) {
        this.users = users;
        this.profiles = profiles;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
    }

    @Transactional(readOnly = true)
    public MeResponse me(UUID userId) {
        return toMe(requireUser(userId), requireProfile(userId));
    }

    @Transactional
    public MeResponse updateProfile(UUID userId, ProfileDto dto) {
        AppUser user = requireUser(userId);
        UserProfile p = requireProfile(userId);
        requireValidZone(dto.timezone());
        p.setDisplayName(dto.displayName().trim());
        p.setCountry(dto.country());
        p.setRegion(dto.region());
        p.setTimezone(dto.timezone());
        p.setUnits(dto.units());
        p.setHouseholdSize(dto.householdSize());
        p.setHeatingType(dto.heatingType());
        p.setDietType(dto.dietType());
        p.setCommuteMode(dto.commuteMode());
        p.setCarFuel(dto.car() == null ? null : dto.car().fuel());
        p.setCarGPerKm(dto.car() == null ? null : dto.car().gPerKm());
        p.setShoppingHabit(dto.shoppingHabit());
        p.setDigestOptIn(dto.digestOptIn());
        p.setOnboardingCompleted(dto.onboardingCompleted());
        p.setUpdatedAt(Instant.now());
        return toMe(user, profiles.save(p));
    }

    @Transactional
    public MeResponse updatePreferences(UUID userId, PreferencesRequest req) {
        AppUser user = requireUser(userId);
        UserProfile p = requireProfile(userId);
        if (req.units() != null) {
            p.setUnits(req.units());
        }
        if (req.timezone() != null) {
            requireValidZone(req.timezone());
            p.setTimezone(req.timezone());
        }
        if (req.digestOptIn() != null) {
            p.setDigestOptIn(req.digestOptIn());
        }
        p.setUpdatedAt(Instant.now());
        return toMe(user, profiles.save(p));
    }

    /** Erases the account; profile and tokens go with it through ON DELETE CASCADE. */
    @Transactional
    public void deleteAccount(UUID userId, String password) {
        AppUser user = requireUser(userId);
        if (!encoder.matches(password, user.getPasswordHash())) {
            throw ApiException.forbidden("invalid_password", "Password is incorrect");
        }
        refreshTokens.revokeAllForUser(userId, Instant.now());
        users.delete(user);
    }

    public static MeResponse toMe(AppUser u, UserProfile p) {
        CarDto car = p.getCarFuel() == null && p.getCarGPerKm() == null ? null
                : new CarDto(p.getCarFuel(), p.getCarGPerKm());
        ProfileDto dto = new ProfileDto(p.getDisplayName(), p.getCountry(), p.getRegion(), p.getTimezone(),
                p.getUnits(), p.getHouseholdSize(), p.getHeatingType(), p.getDietType(), p.getCommuteMode(), car,
                p.getShoppingHabit(), p.isDigestOptIn(), p.isOnboardingCompleted());
        return new MeResponse(u.getId(), u.getEmail(), u.getRole(), u.getStatus(), dto);
    }

    private AppUser requireUser(UUID id) {
        return users.findById(id).orElseThrow(() -> ApiException.unauthorized("Account no longer exists"));
    }

    private UserProfile requireProfile(UUID id) {
        return profiles.findById(id).orElseThrow(() -> ApiException.notFound("Profile not found"));
    }

    private static void requireValidZone(String tz) {
        try {
            ZoneId.of(tz);
        } catch (Exception e) {
            throw ApiException.unprocessable("invalid_timezone", "Unknown timezone");
        }
    }
}
