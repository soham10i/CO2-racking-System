package com.co2tracker.notification;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.notification.NotificationDtos.NotificationList;
import com.co2tracker.notification.NotificationDtos.NotificationSettings;
import com.co2tracker.notification.NotificationDtos.SettingsRequest;
import com.co2tracker.notification.NotificationDtos.SubscriptionRequest;
import com.co2tracker.notification.NotificationDtos.UnsubscribeRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public NotificationList list(@AuthenticationPrincipal AuthPrincipal p) {
        return service.list(p.userId());
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        service.markRead(p.userId(), id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void readAll(@AuthenticationPrincipal AuthPrincipal p) {
        service.markAllRead(p.userId());
    }

    @GetMapping("/settings")
    public NotificationSettings settings(@AuthenticationPrincipal AuthPrincipal p) {
        return service.settings(p.userId());
    }

    @PutMapping("/settings")
    public NotificationSettings updateSettings(@AuthenticationPrincipal AuthPrincipal p,
            @RequestBody SettingsRequest req) {
        return service.updateSettings(p.userId(), req);
    }

    @PostMapping("/push-subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody SubscriptionRequest req) {
        service.subscribe(p.userId(), req);
    }

    @DeleteMapping("/push-subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody UnsubscribeRequest req) {
        service.unsubscribe(p.userId(), req.endpoint());
    }
}
