package com.co2tracker.notification;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class NotificationDtos {

    private NotificationDtos() {
    }

    public record NotificationItem(UUID id, Notification.Kind kind, String title, String body, String link,
            Instant createdAt, boolean read) {
    }

    public record NotificationList(long unread, List<NotificationItem> items) {
    }

    /** {@code digest} is the existing weekly-email opt-in; push is per device, so it is not a flag here. */
    public record NotificationSettings(boolean budget, boolean templates, boolean digest, boolean pushAvailable,
            String vapidPublicKey, int pushDevices) {
    }

    public record SettingsRequest(Boolean budget, Boolean templates, Boolean digest) {
    }

    /** The shape of the browser's {@code PushSubscription.toJSON()}; expirationTime is ignored. */
    public record SubscriptionRequest(@NotBlank @Size(max = 600) String endpoint, @NotNull @Valid Keys keys) {

        public record Keys(@NotBlank @Size(max = 120) String p256dh, @NotBlank @Size(max = 40) String auth) {
        }
    }

    public record UnsubscribeRequest(@NotBlank @Size(max = 600) String endpoint) {
    }
}
