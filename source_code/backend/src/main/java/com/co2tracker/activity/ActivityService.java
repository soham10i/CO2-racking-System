package com.co2tracker.activity;

import com.co2tracker.activity.ActivityDtos.ActivityRequest;
import com.co2tracker.activity.ActivityDtos.ActivityResponse;
import com.co2tracker.activity.ActivityDtos.CompareOption;
import com.co2tracker.activity.ActivityDtos.CompareResponse;
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
import com.co2tracker.household.HouseholdService;
import com.co2tracker.notification.Notification.Kind;
import com.co2tracker.notification.NotificationService;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
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
    private final HouseholdService households;
    private final NotificationService notifications;
    private final Clock clock;

    public ActivityService(ActivityRepository activities, EmissionFactorRepository factorRepo, FactorService factors,
            EmissionEngine engine, UserCalendar calendar, ApplicationEventPublisher events,
            HouseholdService households, NotificationService notifications, Clock clock) {
        this.activities = activities;
        this.factorRepo = factorRepo;
        this.factors = factors;
        this.engine = engine;
        this.calendar = calendar;
        this.events = events;
        this.households = households;
        this.notifications = notifications;
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

    /**
     * The estimate, plus every other active subtype of the category that has the same unit, through the same
     * engine. Passengers carry over only to shareable options; options the quantity exceeds are left out.
     */
    @Transactional(readOnly = true)
    public CompareResponse compare(UUID userId, EstimateRequest req) {
        UserProfile p = calendar.profile(userId);
        LocalDate date = req.occurredOn() != null ? req.occurredOn() : calendar.today(p);
        Calc calc = calculate(p, req.category(), req.subtype(), req.quantity(), date, req.passengers());
        List<CompareOption> alternatives = factors.activeFor(req.category(), p.getCountry(), date).stream()
                .filter(f -> !f.getSubtype().equals(calc.factor.getSubtype()))
                .filter(f -> f.getUnit().equals(calc.factor.getUnit()))
                .filter(f -> req.quantity().compareTo(f.getMaxQuantity()) <= 0)
                .map(f -> {
                    BigDecimal kg = engine.kgCo2e(f, req.quantity(), f.isShareable() ? calc.passengers : 1);
                    return new CompareOption(f.getSubtype(), f.getLabel(), f.getUnit(), kg, calc.kg.subtract(kg));
                })
                .sorted(Comparator.comparing(CompareOption::kgCo2e).thenComparing(CompareOption::subtype))
                .toList();
        return new CompareResponse(new CompareOption(calc.factor.getSubtype(), calc.factor.getLabel(),
                calc.factor.getUnit(), calc.kg, null), alternatives);
    }

    /** Runs every check {@link #create} runs and returns the emission it would book, without saving. */
    @Transactional(readOnly = true)
    public EstimateResponse check(UUID userId, ActivityRequest req) {
        UserProfile p = calendar.profile(userId);
        validateDate(req.occurredOn(), calendar.today(p));
        Calc calc = calculate(p, req.category(), req.subtype(), req.quantity(), req.occurredOn(), req.passengers());
        return new EstimateResponse(calc.kg, calc.factor.getUnit(), calc.factor.getLabel(),
                ActivityMapper.ref(calc.factor));
    }

    /** Every activity of the user, oldest first, for export. */
    @Transactional(readOnly = true)
    public List<ActivityResponse> all(UUID userId) {
        List<Activity> list = activities.findByUserIdOrderByOccurredOnAscCreatedAtAsc(userId);
        Map<UUID, EmissionFactor> byId = factorRepo
                .findAllById(list.stream().map(Activity::getFactorId).distinct().toList()).stream()
                .collect(Collectors.toMap(EmissionFactor::getId, Function.identity()));
        return list.stream().map(a -> ActivityMapper.activity(a, byId.get(a.getFactorId()))).toList();
    }

    public ActivityResponse create(UUID userId, ActivityRequest req) {
        UserProfile p = calendar.profile(userId);
        validateDate(req.occurredOn(), calendar.today(p));
        Calc calc = calculate(p, req.category(), req.subtype(), req.quantity(), req.occurredOn(), req.passengers());
        if (Boolean.TRUE.equals(req.shareWithHousehold())) {
            return createShared(p, req, calc);
        }

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
        if (a.getShareGroupId() != null) {
            return updateShared(a, req, calc);
        }
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
        List<Activity> group = a.getShareGroupId() == null ? List.of(a) : editableGroup(a);
        for (Activity copy : group) {
            activities.delete(copy);
            publish(copy, BigDecimal.ONE.negate());
        }
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

    // ---- household sharing -------------------------------------------------------------------

    /** One copy per current member, each with quantity / n, so every member's totals carry their own share. */
    private ActivityResponse createShared(UserProfile p, ActivityRequest req, Calc calc) {
        if (req.category() != Category.ENERGY && req.category() != Category.WASTE) {
            throw ApiException.unprocessable("share_not_applicable", "Only home energy and waste can be shared");
        }
        List<UUID> ids = households.memberIds(p.getUserId());
        if (ids.size() < 2) {
            throw ApiException.unprocessable("no_household", "Join or create a household with someone to share");
        }
        Calc part = partOf(calc, req.quantity(), ids.size());
        UUID group = UUID.randomUUID();
        Instant now = clock.instant();
        Activity mine = null;
        for (UUID member : ids) {
            Activity a = new Activity();
            a.setId(UUID.randomUUID());
            a.setUserId(member);
            a.setCreatedAt(now);
            a.setShareGroupId(group);
            a.setShareCount(ids.size());
            a.setSharedBy(p.getUserId());
            applyShare(a, req, part, now);
            Activity saved = activities.save(a);
            publish(saved, BigDecimal.ONE);
            if (member.equals(p.getUserId())) {
                mine = saved;
            } else {
                notifyShare(member, p.getDisplayName(), calc.factor.getLabel(), saved.getKgCo2e(), group);
            }
        }
        return ActivityMapper.activity(mine, calc.factor);
    }

    /** The same split as when it was logged: who shares an entry never changes afterwards. */
    private ActivityResponse updateShared(Activity a, ActivityRequest req, Calc calc) {
        if (req.category() != Category.ENERGY && req.category() != Category.WASTE) {
            throw ApiException.unprocessable("share_not_applicable", "Only home energy and waste can be shared");
        }
        List<Activity> group = editableGroup(a);
        Calc part = partOf(calc, req.quantity(), a.getShareCount());
        Instant now = clock.instant();
        Activity mine = a;
        for (Activity copy : group) {
            publish(copy, BigDecimal.ONE.negate());
            applyShare(copy, req, part, now);
            Activity saved = activities.saveAndFlush(copy);
            publish(saved, BigDecimal.ONE);
            if (saved.getId().equals(a.getId())) {
                mine = saved;
            }
        }
        return ActivityMapper.activity(mine, calc.factor);
    }

    private List<Activity> editableGroup(Activity a) {
        if (!a.getUserId().equals(a.getSharedBy())) {
            throw ApiException.forbidden("shared_read_only", "Only the member who logged a shared entry can change it");
        }
        return activities.findByShareGroupId(a.getShareGroupId());
    }

    private Calc partOf(Calc total, BigDecimal quantity, int n) {
        BigDecimal part = quantity.divide(BigDecimal.valueOf(n), 3, RoundingMode.HALF_EVEN);
        if (part.signum() == 0) {
            throw ApiException.unprocessable("quantity_too_small", "The quantity is too small to split");
        }
        return new Calc(total.factor, engine.kgCo2e(total.factor, part, 1), 1);
    }

    private void applyShare(Activity a, ActivityRequest req, Calc part, Instant now) {
        apply(a, req, part, now);
        a.setQuantity(req.quantity().divide(BigDecimal.valueOf(a.getShareCount()), 3, RoundingMode.HALF_EVEN));
        a.setShareTotalQuantity(req.quantity());
    }

    private void notifyShare(UUID member, String by, String label, BigDecimal kg, UUID group) {
        boolean de = "de".equals(calendar.profile(member).getLocale());
        String amount = kg.setScale(1, RoundingMode.HALF_EVEN).toPlainString();
        notifications.notify(member, Kind.HOUSEHOLD, "share-" + group,
                de ? "Geteilter Eintrag" : "Shared entry",
                de ? by + " hat „" + label + "“ geteilt: dein Anteil " + amount.replace('.', ',') + " kg CO2e."
                        : by + " shared \"" + label + "\": your part is " + amount + " kg CO2e.",
                "/log");
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
