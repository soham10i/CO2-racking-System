package com.co2tracker.insights;

import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.activity.ActivityRepository.QuantitySum;
import com.co2tracker.common.ApiException;
import com.co2tracker.insights.InsightsDtos.Scope2Response;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import com.co2tracker.user.UserProfileRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Market-based electricity as a second figure beside the location-based one. It is reported, never booked: the
 * log, totals, budget and charts all stay location-based, so the two methods cannot be mixed by accident.
 */
@Service
@Transactional
public class Scope2Service {

    static final String SUBTYPE = "ELECTRICITY";

    private final ActivityRepository activities;
    private final UserCalendar calendar;
    private final UserProfileRepository profiles;
    private final Clock clock;

    public Scope2Service(ActivityRepository activities, UserCalendar calendar, UserProfileRepository profiles,
            Clock clock) {
        this.activities = activities;
        this.calendar = calendar;
        this.profiles = profiles;
        this.clock = clock;
    }

    /** Defaults to this calendar year up to today. */
    @Transactional(readOnly = true)
    public Scope2Response get(UUID userId, LocalDate from, LocalDate to) {
        UserProfile p = calendar.profile(userId);
        LocalDate today = calendar.today(p);
        LocalDate end = to == null ? today : to;
        LocalDate start = from == null ? end.withDayOfYear(1) : from;
        if (start.isAfter(end)) {
            throw ApiException.badRequest("invalid_range", "from must not be after to");
        }
        QuantitySum sum = activities.sumBySubtype(userId, SUBTYPE, start, end);
        BigDecimal kwh = sum.getQuantity().setScale(1, RoundingMode.HALF_EVEN);
        BigDecimal locationKg = sum.getKg().setScale(1, RoundingMode.HALF_EVEN);
        BigDecimal locationG = kwh.signum() == 0 ? null
                : sum.getKg().multiply(BigDecimal.valueOf(1000)).divide(sum.getQuantity(), 0, RoundingMode.HALF_EVEN);
        BigDecimal supplier = p.getSupplierGPerKwh();
        BigDecimal marketKg = supplier == null ? null
                : sum.getQuantity().multiply(supplier).divide(BigDecimal.valueOf(1000), 1, RoundingMode.HALF_EVEN);
        return new Scope2Response(start, end, kwh, locationKg, locationG, supplier, marketKg);
    }

    public Scope2Response setSupplier(UUID userId, BigDecimal gramsPerKwh) {
        UserProfile p = calendar.profile(userId);
        p.setSupplierGPerKwh(gramsPerKwh == null ? null : gramsPerKwh.setScale(1, RoundingMode.HALF_EVEN));
        p.setUpdatedAt(clock.instant());
        profiles.save(p);
        return get(userId, null, null);
    }
}
