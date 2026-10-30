package com.co2tracker.template;

import com.co2tracker.activity.ActivityDtos.ActivityRequest;
import com.co2tracker.activity.ActivityDtos.ActivityResponse;
import com.co2tracker.activity.ActivityDtos.EstimateRequest;
import com.co2tracker.activity.ActivityDtos.EstimateResponse;
import com.co2tracker.activity.ActivityService;
import com.co2tracker.common.ApiException;
import com.co2tracker.emission.Category;
import com.co2tracker.template.TemplateDtos.TemplateRequest;
import com.co2tracker.template.TemplateDtos.TemplateResponse;
import com.co2tracker.user.UserCalendar;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Templates reuse {@link ActivityService} for every booking, so a logged template is an ordinary activity:
 * same validation, factor resolution and read-model update.
 */
@Service
@Transactional
public class TemplateService {

    static final int MAX_TEMPLATES = 50;
    /** A recurring series never back-fills more than this many days, however long it was dormant. */
    static final int MAX_CATCH_UP_DAYS = 31;
    private static final int MAX_START_AHEAD_DAYS = 366;

    private final TemplateRepository templates;
    private final ActivityService activities;
    private final UserCalendar calendar;
    private final Clock clock;

    public TemplateService(TemplateRepository templates, ActivityService activities, UserCalendar calendar,
            Clock clock) {
        this.templates = templates;
        this.activities = activities;
        this.calendar = calendar;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<TemplateResponse> list(UUID userId) {
        LocalDate today = calendar.today(userId);
        return templates.findByUserIdOrderByCreatedAtAsc(userId).stream().map(t -> toResponse(t, today)).toList();
    }

    public TemplateResponse create(UUID userId, TemplateRequest req) {
        if (templates.countByUserId(userId) >= MAX_TEMPLATES) {
            throw ApiException.unprocessable("too_many_templates", "You can keep up to " + MAX_TEMPLATES + " templates");
        }
        LocalDate today = calendar.today(userId);
        Instant now = clock.instant();
        ActivityTemplate t = new ActivityTemplate();
        t.setId(UUID.randomUUID());
        t.setUserId(userId);
        t.setCreatedAt(now);
        apply(t, req, today, now);
        ActivityTemplate saved = templates.save(t);
        catchUp(saved, today);
        templates.flush(); // so the response carries the version after catch-up moved next_run_on
        return toResponse(saved, today);
    }

    public TemplateResponse update(UUID userId, UUID id, TemplateRequest req) {
        ActivityTemplate t = owned(userId, id);
        if (req.version() == null) {
            throw ApiException.unprocessable("version_required", "The current version is required to update");
        }
        if (!req.version().equals(t.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "stale_version",
                    "This template was changed elsewhere; reload and try again");
        }
        LocalDate today = calendar.today(userId);
        apply(t, req, today, clock.instant());
        catchUp(t, today);
        ActivityTemplate saved = templates.saveAndFlush(t);
        return toResponse(saved, today);
    }

    /** Deleting a template keeps everything it already booked. */
    public void delete(UUID userId, UUID id) {
        templates.delete(owned(userId, id));
    }

    public ActivityResponse log(UUID userId, UUID id, LocalDate occurredOn) {
        ActivityTemplate t = owned(userId, id);
        return book(t, occurredOn != null ? occurredOn : calendar.today(userId));
    }

    /** Ids the recurring job should look at; {@code date} is a UTC date, generous for the earliest timezones. */
    @Transactional(readOnly = true)
    public List<UUID> dueIds(LocalDate date) {
        return templates.dueOnOrBefore(date);
    }

    /** Books every run due up to the owner's today. Each call is one transaction, so one bad template stays isolated. */
    public int catchUp(UUID templateId) {
        return templates.findById(templateId).map(t -> catchUp(t, calendar.today(t.getUserId()))).orElse(0);
    }

    // ---- helpers -----------------------------------------------------------------------------

    private int catchUp(ActivityTemplate t, LocalDate today) {
        LocalDate next = t.getNextRunOn();
        if (next == null) {
            return 0;
        }
        LocalDate oldest = today.minusDays(MAX_CATCH_UP_DAYS);
        while (next.isBefore(oldest)) {
            next = t.getRecurrence().next(next, t.getStartsOn());
        }
        int booked = 0;
        while (!next.isAfter(today)) {
            book(t, next);
            booked++;
            next = t.getRecurrence().next(next, t.getStartsOn());
        }
        t.setNextRunOn(next);
        return booked;
    }

    private ActivityResponse book(ActivityTemplate t, LocalDate on) {
        return activities.create(t.getUserId(), new ActivityRequest(t.getCategory(), t.getSubtype(), t.getQuantity(),
                on, t.getPassengers(), t.getNote(), null));
    }

    private void apply(ActivityTemplate t, TemplateRequest req, LocalDate today, Instant now) {
        // Validates subtype and quantity exactly as a booking would, before anything is stored.
        activities.estimate(t.getUserId(), estimateOf(req.category(), req.subtype(), req.quantity(), today,
                req.passengers()));

        LocalDate startsOn = null;
        LocalDate nextRunOn = null;
        if (req.recurrence() != Recurrence.NONE) {
            startsOn = req.startsOn() != null ? req.startsOn() : today;
            if (startsOn.isBefore(today.minusDays(MAX_CATCH_UP_DAYS))) {
                throw ApiException.unprocessable("start_too_old",
                        "A recurring entry can start at most " + MAX_CATCH_UP_DAYS + " days ago");
            }
            if (startsOn.isAfter(today.plusDays(MAX_START_AHEAD_DAYS))) {
                throw ApiException.unprocessable("start_too_far", "A recurring entry must start within a year");
            }
            boolean scheduleChanged = t.getRecurrence() != req.recurrence() || !startsOn.equals(t.getStartsOn());
            if (scheduleChanged) {
                // Every date before the old next run is already booked; never book those again.
                LocalDate from = t.getNextRunOn() != null && t.getNextRunOn().isAfter(startsOn) ? t.getNextRunOn()
                        : startsOn;
                nextRunOn = req.recurrence().firstOnOrAfter(startsOn, from);
            } else {
                nextRunOn = t.getNextRunOn();
            }
        }

        t.setName(req.name().strip());
        t.setCategory(req.category());
        t.setSubtype(req.subtype());
        t.setQuantity(req.quantity());
        t.setPassengers(req.passengers() == null ? 1 : req.passengers());
        t.setNote(req.note() == null || req.note().isBlank() ? null : req.note().strip());
        t.setRecurrence(req.recurrence());
        t.setStartsOn(startsOn);
        t.setNextRunOn(nextRunOn);
        t.setUpdatedAt(now);
    }

    private TemplateResponse toResponse(ActivityTemplate t, LocalDate today) {
        EstimateResponse e = activities.estimate(t.getUserId(),
                estimateOf(t.getCategory(), t.getSubtype(), t.getQuantity(), today, t.getPassengers()));
        return new TemplateResponse(t.getId(), t.getName(), t.getCategory(), t.getSubtype(), e.label(),
                t.getQuantity(), e.unit(), t.getPassengers(), t.getNote(), t.getRecurrence(), t.getStartsOn(),
                t.getNextRunOn(), e.kgCo2e(), t.getVersion() == null ? 0 : t.getVersion());
    }

    private static EstimateRequest estimateOf(Category category, String subtype, BigDecimal quantity, LocalDate on,
            Integer passengers) {
        return new EstimateRequest(category, subtype, quantity, on, passengers);
    }

    private ActivityTemplate owned(UUID userId, UUID id) {
        return templates.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Template not found"));
    }
}
