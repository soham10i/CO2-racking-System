package com.co2tracker.insights;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActionDecisionRepository extends JpaRepository<ActionDecision, UUID> {

    List<ActionDecision> findByUserId(UUID userId);

    Optional<ActionDecision> findByUserIdAndActionKey(UUID userId, String actionKey);
}
