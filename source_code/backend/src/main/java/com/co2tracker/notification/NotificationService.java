package com.co2tracker.notification;

import com.co2tracker.common.ApiException;
import com.co2tracker.notification.Notification.Kind;
import com.co2tracker.notification.NotificationDtos.NotificationItem;
import com.co2tracker.notification.NotificationDtos.NotificationList;
import com.co2tracker.notification.NotificationDtos.NotificationSettings;
import com.co2tracker.notification.NotificationDtos.SettingsRequest;
import com.co2tracker.notification.NotificationDtos.SubscriptionRequest;
import com.co2tracker.user.UserCalendar;
import com.co2tracker.user.UserProfile;
import com.co2tracker.user.UserProfileRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** The in-app notification centre, plus a web-push copy to each of the user's subscribed devices. */
@Service
@Transactional
public class NotificationService {

    static final int LIST_SIZE = 50;
    static final int MAX_DEVICES = 10;

    private final NotificationRepository notifications;
    private final PushSubscriptionRepository subscriptions;
    private final UserProfileRepository profiles;
    private final UserCalendar calendar;
    private final WebPushSender push;
    private final ObjectMapper json;
    private final Clock clock;
    private final ExecutorService pushPool = Executors.newVirtualThreadPerTaskExecutor();

    public NotificationService(NotificationRepository notifications, PushSubscriptionRepository subscriptions,
            UserProfileRepository profiles, UserCalendar calendar, WebPushSender push, ObjectMapper json,
            Clock clock) {
        this.notifications = notifications;
        this.subscriptions = subscriptions;
        this.profiles = profiles;
        this.calendar = calendar;
        this.push = push;
        this.json = json;
        this.clock = clock;
    }

    /**
     * Records a notification unless one with the same {@code dedupeKey} exists; returns whether it was new. The
     * push copy goes out after the surrounding transaction commits, so a rollback never sends a phantom alert.
     */
    public boolean notify(UUID userId, Kind kind, String dedupeKey, String title, String body, String link) {
        if (notifications.existsByUserIdAndDedupeKey(userId, dedupeKey)) {
            return false;
        }
        Notification n = new Notification();
        n.setId(UUID.randomUUID());
        n.setUserId(userId);
        n.setKind(kind);
        n.setTitle(truncate(title, 120));
        n.setBody(truncate(body, 400));
        n.setLink(link);
        n.setDedupeKey(dedupeKey);
        n.setCreatedAt(clock.instant());
        notifications.save(n);
        if (push.enabled()) {
            String payload = payload(n);
            Runnable send = () -> pushPool.submit(() -> pushToDevices(userId, payload));
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        send.run();
                    }
                });
            } else {
                send.run();
            }
        }
        return true;
    }

    @Transactional(readOnly = true)
    public NotificationList list(UUID userId) {
        List<NotificationItem> items = notifications.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, LIST_SIZE))
                .stream()
                .map(n -> new NotificationItem(n.getId(), n.getKind(), n.getTitle(), n.getBody(), n.getLink(),
                        n.getCreatedAt(), n.getReadAt() != null))
                .toList();
        return new NotificationList(notifications.countByUserIdAndReadAtIsNull(userId), items);
    }

    public void markRead(UUID userId, UUID id) {
        Notification n = notifications.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("Notification not found"));
        if (n.getReadAt() == null) {
            n.setReadAt(clock.instant());
        }
    }

    public void markAllRead(UUID userId) {
        notifications.markAllRead(userId, clock.instant());
    }

    @Transactional(readOnly = true)
    public NotificationSettings settings(UUID userId) {
        UserProfile p = calendar.profile(userId);
        return new NotificationSettings(p.isNotifyBudget(), p.isNotifyTemplates(), p.isDigestOptIn(), push.enabled(),
                push.publicKey(), (int) subscriptions.countByUserId(userId));
    }

    public NotificationSettings updateSettings(UUID userId, SettingsRequest req) {
        UserProfile p = calendar.profile(userId);
        if (req.budget() != null) {
            p.setNotifyBudget(req.budget());
        }
        if (req.templates() != null) {
            p.setNotifyTemplates(req.templates());
        }
        if (req.digest() != null) {
            p.setDigestOptIn(req.digest());
        }
        p.setUpdatedAt(clock.instant());
        profiles.save(p);
        return settings(userId);
    }

    /** Re-subscribing the same browser moves the subscription to the current account. */
    public void subscribe(UUID userId, SubscriptionRequest req) {
        if (!push.enabled()) {
            throw ApiException.unprocessable("push_unavailable", "Push notifications are not configured on this server");
        }
        if (!push.allowed(req.endpoint())) {
            throw ApiException.unprocessable("push_service_not_allowed", "This push service is not supported");
        }
        PushSubscription s = subscriptions.findByEndpoint(req.endpoint()).orElseGet(PushSubscription::new);
        if (s.getId() == null) {
            if (subscriptions.countByUserId(userId) >= MAX_DEVICES) {
                throw ApiException.unprocessable("too_many_devices", "Push is already on for " + MAX_DEVICES + " devices");
            }
            s.setId(UUID.randomUUID());
            s.setEndpoint(req.endpoint());
            s.setCreatedAt(clock.instant());
        }
        s.setUserId(userId);
        s.setP256dh(req.keys().p256dh());
        s.setAuth(req.keys().auth());
        subscriptions.save(s);
    }

    public void unsubscribe(UUID userId, String endpoint) {
        subscriptions.findByEndpoint(endpoint).filter(s -> s.getUserId().equals(userId)).ifPresent(subscriptions::delete);
    }

    // ---- helpers -----------------------------------------------------------------------------

    private void pushToDevices(UUID userId, String payload) {
        for (PushSubscription s : subscriptions.findByUserId(userId)) {
            if (push.send(s, payload) == WebPushSender.Result.GONE) {
                // The browser unsubscribed or the subscription expired: stop posting to it.
                subscriptions.deleteById(s.getId());
            }
        }
    }

    private String payload(Notification n) {
        try {
            return json.writeValueAsString(Map.of("title", n.getTitle(), "body", n.getBody(),
                    "link", n.getLink() == null ? "/notifications" : n.getLink(), "tag", n.getDedupeKey()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
