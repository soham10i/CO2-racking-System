package com.co2tracker.user;

import com.co2tracker.user.ProfileEnums.CarFuel;
import com.co2tracker.user.ProfileEnums.CommuteMode;
import com.co2tracker.user.ProfileEnums.DietType;
import com.co2tracker.user.ProfileEnums.HeatingType;
import com.co2tracker.user.ProfileEnums.Role;
import com.co2tracker.user.ProfileEnums.ShoppingHabit;
import com.co2tracker.user.ProfileEnums.Units;
import com.co2tracker.user.ProfileEnums.UserStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class UserDtos {

    private UserDtos() {
    }

    public record CarDto(CarFuel fuel, @Min(0) @Max(1000) Integer gPerKm) {
    }

    public record ProfileDto(
            @NotBlank @Size(max = 80) String displayName,
            @Pattern(regexp = "[A-Z]{2}", message = "must be an ISO 3166 alpha-2 code") String country,
            @Size(max = 16) String region,
            @NotBlank @Size(max = 64) String timezone,
            @NotNull Units units,
            @Min(1) @Max(20) Integer householdSize,
            HeatingType heatingType,
            DietType dietType,
            CommuteMode commuteMode,
            @Valid CarDto car,
            ShoppingHabit shoppingHabit,
            boolean digestOptIn,
            boolean onboardingCompleted,
            /** Omitted on save keeps the current language. */
            @Pattern(regexp = "en|de", message = "must be en or de") String locale) {
    }

    public record MeResponse(UUID id, String email, Role role, UserStatus status, ProfileDto profile) {
    }

    public record PreferencesRequest(Units units, @Size(max = 64) String timezone, Boolean digestOptIn,
            @Pattern(regexp = "en|de", message = "must be en or de") String locale) {
    }

    public record DeleteAccountRequest(@NotBlank @Size(max = 128) String password) {
    }
}
