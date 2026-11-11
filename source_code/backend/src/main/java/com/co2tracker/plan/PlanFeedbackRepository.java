package com.co2tracker.plan;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanFeedbackRepository extends JpaRepository<PlanFeedback, UUID> {

    List<PlanFeedback> findByUserIdOrderByCreatedAtAsc(UUID userId);
}
