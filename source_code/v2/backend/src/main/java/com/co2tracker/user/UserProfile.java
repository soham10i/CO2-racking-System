package com.co2tracker.user;

import com.co2tracker.user.ProfileEnums.CarFuel;
import com.co2tracker.user.ProfileEnums.CommuteMode;
import com.co2tracker.user.ProfileEnums.DietType;
import com.co2tracker.user.ProfileEnums.HeatingType;
import com.co2tracker.user.ProfileEnums.ShoppingHabit;
import com.co2tracker.user.ProfileEnums.Units;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_profile")
@Getter
@Setter
@NoArgsConstructor
public class UserProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Column(length = 2)
    private String country;

    @Column(length = 16)
    private String region;

    @Column(nullable = false, length = 64)
    private String timezone = "UTC";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Units units = Units.METRIC;

    @Column(name = "household_size")
    private Integer householdSize;

    @Enumerated(EnumType.STRING)
    @Column(name = "heating_type", length = 24)
    private HeatingType heatingType;

    @Enumerated(EnumType.STRING)
    @Column(name = "diet_type", length = 24)
    private DietType dietType;

    @Enumerated(EnumType.STRING)
    @Column(name = "commute_mode", length = 24)
    private CommuteMode commuteMode;

    @Enumerated(EnumType.STRING)
    @Column(name = "car_fuel", length = 16)
    private CarFuel carFuel;

    @Column(name = "car_g_per_km")
    private Integer carGPerKm;

    @Enumerated(EnumType.STRING)
    @Column(name = "shopping_habit", length = 16)
    private ShoppingHabit shoppingHabit;

    @Column(name = "digest_opt_in", nullable = false)
    private boolean digestOptIn;

    @Column(name = "onboarding_completed", nullable = false)
    private boolean onboardingCompleted;

    @Column(name = "monthly_budget_kg", precision = 10, scale = 1)
    private BigDecimal monthlyBudgetKg;

    @Column(name = "baseline_answers", length = 2000)
    private String baselineAnswers;

    @Column(name = "baseline_at")
    private Instant baselineAt;

    @Column(name = "digest_sent_on")
    private LocalDate digestSentOn;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
