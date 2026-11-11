package com.co2tracker.user;

import com.co2tracker.common.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The user's local calendar: activities and periods are dated in the user's timezone, not the server's. */
@Component
@Transactional(readOnly = true)
public class UserCalendar {

    private final UserProfileRepository profiles;
    private final Clock clock;

    public UserCalendar(UserProfileRepository profiles, Clock clock) {
        this.profiles = profiles;
        this.clock = clock;
    }

    public UserProfile profile(UUID userId) {
        return profiles.findById(userId).orElseThrow(() -> ApiException.unauthorized("Unknown user"));
    }

    public LocalDate today(UUID userId) {
        return today(profile(userId));
    }

    public LocalDate today(UserProfile p) {
        return LocalDate.now(clock.withZone(zoneOf(p)));
    }

    /** The user's timezone; an unknown id falls back to UTC rather than failing the request. */
    public static ZoneId zoneOf(UserProfile p) {
        try {
            return ZoneId.of(p.getTimezone());
        } catch (RuntimeException e) {
            return ZoneId.of("UTC");
        }
    }
}
