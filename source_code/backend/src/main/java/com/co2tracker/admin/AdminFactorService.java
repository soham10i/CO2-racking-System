package com.co2tracker.admin;

import com.co2tracker.activity.ActivityRepository;
import com.co2tracker.admin.AdminFactorDtos.AdminFactor;
import com.co2tracker.admin.AdminFactorDtos.Preview;
import com.co2tracker.admin.AdminFactorDtos.VersionRequest;
import com.co2tracker.common.ApiException;
import com.co2tracker.emission.EmissionFactor;
import com.co2tracker.emission.EmissionFactorRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Publishes factor versions: the current row is closed and the next one starts, nothing is edited in place. */
@Service
@Transactional
public class AdminFactorService {

    private static final Logger log = LoggerFactory.getLogger(AdminFactorService.class);
    /** New versions may be scheduled up to a year ahead (e.g. next year's grid factor). */
    private static final int MAX_DAYS_AHEAD = 366;

    private final EmissionFactorRepository factors;
    private final ActivityRepository activities;
    private final Clock clock;

    public AdminFactorService(EmissionFactorRepository factors, ActivityRepository activities, Clock clock) {
        this.factors = factors;
        this.activities = activities;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AdminFactor> list() {
        return factors.findAllForAdmin().stream().map(AdminFactorService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public Preview preview(UUID id, VersionRequest req) {
        EmissionFactor current = openVersion(id, req.validFrom());
        BigDecimal now = current.getKgCo2ePerUnit();
        BigDecimal change = now.signum() == 0 ? null
                : req.kgCo2ePerUnit().subtract(now).multiply(BigDecimal.valueOf(100)).divide(now, 1, RoundingMode.HALF_EVEN);
        return new Preview(now, req.kgCo2ePerUnit(), change, nextVersion(current), req.validFrom(),
                activities.countByFactorIdAndOccurredOnGreaterThanEqual(current.getId(), req.validFrom()));
    }

    public AdminFactor publish(UUID adminId, UUID id, VersionRequest req) {
        EmissionFactor current = openVersion(id, req.validFrom());
        EmissionFactor next = current.nextVersion(nextVersion(current), req.validFrom(),
                req.kgCo2ePerUnit().setScale(6, RoundingMode.HALF_EVEN), req.sourceName().strip(),
                blankToNull(req.sourceUrl()), blankToNull(req.methodNote()), adminId, clock.instant());
        current.closeAt(req.validFrom());
        factors.save(current);
        factors.save(next);
        log.info("Factor {}/{} region={} v{} published by {} (valid from {})", next.getCategory(), next.getSubtype(),
                next.getRegion(), next.getVersion(), adminId, next.getValidFrom());
        return toDto(next);
    }

    /** Only the open (latest) version can be superseded, and only by one that starts after it. */
    private EmissionFactor openVersion(UUID id, LocalDate from) {
        EmissionFactor f = factors.findById(id).orElseThrow(() -> ApiException.notFound("Factor not found"));
        if (f.getValidTo() != null) {
            throw ApiException.unprocessable("not_current", "Only the current version of a factor can be replaced");
        }
        if (!from.isAfter(f.getValidFrom())) {
            throw ApiException.unprocessable("invalid_valid_from", "The new version must start after " + f.getValidFrom());
        }
        if (from.isAfter(LocalDate.now(clock.withZone(ZoneOffset.UTC)).plusDays(MAX_DAYS_AHEAD))) {
            throw ApiException.unprocessable("invalid_valid_from", "The new version can start at most a year ahead");
        }
        return f;
    }

    private int nextVersion(EmissionFactor f) {
        return factors.findLine(f.getCategory(), f.getSubtype(), f.getRegion()).stream()
                .mapToInt(EmissionFactor::getVersion).max().orElse(0) + 1;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    static AdminFactor toDto(EmissionFactor f) {
        return new AdminFactor(f.getId(), f.getCategory(), f.getSubtype(), f.getLabel(), f.getUnit(), f.getRegion(),
                f.getKgCo2ePerUnit(), f.getSourceName(), f.getSourceUrl(), f.getMethodNote(), f.getValidFrom(),
                f.getValidTo(), f.getVersion(), f.getValidTo() == null, f.getCreatedAt());
    }
}
