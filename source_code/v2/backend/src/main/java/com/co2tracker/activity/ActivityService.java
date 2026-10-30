package com.co2tracker.activity;

import com.co2tracker.activity.ActivityDtos.ActivityRequest;
import com.co2tracker.activity.ActivityDtos.ActivityResponse;
import com.co2tracker.activity.ActivityDtos.EstimateRequest;
import com.co2tracker.activity.ActivityDtos.EstimateResponse;
import com.co2tracker.activity.ActivityDtos.FactorResponse;
import com.co2tracker.activity.ActivityDtos.PageResponse;
import com.co2tracker.common.ApiException;
import com.co2tracker.emission.Category;
import com.co2tracker.emission.EmissionEngine;
import com.co2tracker.emission.EmissionFactor;
import com.co2tracker.emission.EmissionFactorRepository;
import com.co2tracker.emission.FactorService;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ActivityService {

    static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_AGE_YEARS = 10;

    private final ActivityRepository activities;
    private final EmissionFactorRepository factorRepo;
    private final FactorService factors;
    private final EmissionEngine engine;
    private final UserCalendar calendar;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ActivityService(ActivityRepository activities, EmissionFactorRepository factorRepo, FactorService factors,
            EmissionEngine engine, UserCalendar calendar, ApplicationEventPublisher events, Clock clock) {
        this.activities = activities;
        this.factorRepo = factorRepo;
        this.factors = factors;
        this.engine = engine;
        this.calendar = calendar;
        this.events = events;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<FactorResponse> factors(UUID userId, Category category) {
        UserProfile p = calendar.profile(userId);
        return factors.activeFor(category, p.getCountry(), calendar.today(p)).stream()
                .map(ActivityMapper::factor)
                .toList();
    }

    @Transactional(readOnly = true)
    public EstimateResponse estimate(UUID userId, EstimateRequest req) {
        UserProfile p = calendar.profile(userId);
        LocalDate date = req.occurredOn() != null ? req.occurredOn() : calendar.today(p);
        Calc calc = calculate(p, req.category(), req.subtype(), req.quantity(), date, req.passengers());
        return new EstimateResponse(calc.kg, calc.factor.getUnit(), calc.factor.getLabel(),
                ActivityMapper.ref(calc.factor));
    }

    public ActivityResponse create(UUID userId, ActivityRequest req) {
        UserProfile p = calendar.profile(userId);
        validateDate(req.occurredOn(), calendar.today(p));
        Calc calc = calculate(p, req.category(), req.subtype(), req.quantity(), req.occurredOn(), req.passengers());

        Instant now = clock.instant();
        Activity a = new Activity();
        a.setId(UUID.randomUUID());
        a.setUserId(userId);
        a.setCreatedAt(now);
        apply(a, req, calc, now);
        Activity saved = activities.save(a);
        publish(saved, BigDecimal.ONE);
        return ActivityMapper.activity(saved, calc.factor);
    }

    public ActivityResponse update(UUID userId, UUID id, ActivityRequest req) {
        Activity a = owned(userId, id);
        if (req.version() == null) {
            throw ApiException.unprocessable("version_required", "The current version is required to update");
        }
        if (!req.version().equals(a.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "stale_version",
                    "This activity was changed elsewhere; reload and try again");
        }
        UserProfile p = calendar.profile(userId);
        validateDate(req.occurredOn(), calendar.today(p));
        Calc calc = calculate(p, req.category(), req.subtype(), req.quantity(), req.occurredOn(), req.passengers());
        publish(a, BigDecimal.ONE.negate()); // reverse the old booking before the fields change
        apply(a, req, calc, clock.instant());
        Activity saved = activities.saveAndFlush(a);
        publish(saved, BigDecimal.ONE);
        return ActivityMapper.activity(saved, calc.factor);
    }

    @Transactional(readOnly = true)
    public ActivityResponse get(UUID userId, UUID id) {
        Activity a = owned(userId, id);
        return ActivityMapper.activity(a, factorRepo.getReferenceById(a.getFactorId()));
    }

    public void delete(UUID userId, UUID id) {
        Activity a = owned(userId, id);
        activities.delete(a);
        publish(a, BigDecimal.ONE.negate());
    }

    @Transactional(readOnly = true)
    public PageResponse<ActivityResponse> list(UUID userId, LocalDate from, LocalDate to, Category category,
            String subtype, int page, int size) {
        Specification<Activity> spec = (root, q, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.equal(root.get("userId"), userId));
            if (from != null) {
                ps.add(cb.greaterThanOrEqualTo(root.get("occurredOn"), from));
            }
            if (to != null) {
                ps.add(cb.lessThanOrEqualTo(root.get("occurredOn"), to));
            }
            if (category != null) {
                ps.add(cb.equal(root.get("category"), category));
            }
            if (subtype != null && !subtype.isBlank()) {
                ps.add(cb.equal(root.get("subtype"), subtype));
            }
            return cb.and(ps.toArray(Predicate[]::new));
        };
        // The sort is fixed server-side: no client-controlled property names reach the query.
        Sort sort = Sort.by(Sort.Order.desc("occurredOn"), Sort.Order.desc("createdAt"));
        Page<Activity> result = activities.findAll(spec,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE), sort));

        Map<UUID, EmissionFactor> byId = factorRepo
                .findAllById(result.getContent().stream().map(Activity::getFactorId).distinct().toList()).stream()
                .collect(Collectors.toMap(EmissionFactor::getId, Function.identity()));
        List<ActivityResponse> content = result.getContent().stream()
                .map(a -> ActivityMapper.activity(a, byId.get(a.getFactorId()))).toList();
        return new PageResponse<>(content, result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages());
    }

    // ---- helpers -----------------------------------------------------------------------------

    private record Calc(EmissionFactor factor, BigDecimal kg, int passengers) {
    }

    private Calc calculate(UserProfile p, Category category, String subtype, BigDecimal quantity, LocalDate date,
            Integer requestedPassengers) {
        EmissionFactor factor = factors.resolve(category, subtype, p.getCountry(), date)
                .orElseThrow(() -> ApiException.unprocessable("unknown_subtype",
                        "No emission factor for " + category + "/" + subtype + " on " + date));
        if (quantity.compareTo(factor.getMaxQuantity()) > 0) {
            throw ApiException.unprocessable("quantity_out_of_range",
                    "Quantity must not exceed " + factor.getMaxQuantity().stripTrailingZeros().toPlainString() + " "
                            + factor.getUnit());
        }
        int passengers = requestedPassengers == null ? 1 : requestedPassengers;
        return new Calc(factor, engine.kgCo2e(factor, quantity, passengers), passengers);
    }

    private void apply(Activity a, ActivityRequest req, Calc calc, Instant now) {
        a.setCategory(req.category());
        a.setSubtype(req.subtype());
        a.setQuantity(req.quantity());
        a.setUnit(calc.factor.getUnit());
        a.setOccurredOn(req.occurredOn());
        a.setPassengers(calc.passengers);
        a.setNote(req.note() == null || req.note().isBlank() ? null : req.note().strip());
        a.setFactorId(calc.factor.getId());
        a.setKgCo2e(calc.kg);
        a.setUpdatedAt(now);
    }

    /** Books (sign = 1) or reverses (sign = -1) the activity's current emission in the read models. */
    private void publish(Activity a, BigDecimal sign) {
        events.publishEvent(new ActivityEmissionChanged(a.getUserId(), a.getOccurredOn(), a.getCategory(),
                a.getKgCo2e().multiply(sign)));
    }

    private void validateDate(LocalDate date, LocalDate today) {
        if (date.isAfter(today)) {
            throw ApiException.unprocessable("date_in_future", "The date cannot be in the future");
        }
        if (date.isBefore(today.minusYears(MAX_AGE_YEARS))) {
            throw ApiException.unprocessable("date_too_old", "The date is more than " + MAX_AGE_YEARS + " years ago");
        }
    }

    private Activity owned(UUID userId, UUID id) {
        return activities.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Activity not found"));
    }
}
