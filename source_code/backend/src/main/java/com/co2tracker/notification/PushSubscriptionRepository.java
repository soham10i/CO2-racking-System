package com.co2tracker.notification;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    List<PushSubscription> findByUserId(UUID userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    long countByUserId(UUID userId);
}
