package com.co2tracker.template;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TemplateRepository extends JpaRepository<ActivityTemplate, UUID> {

    Optional<ActivityTemplate> findByIdAndUserId(UUID id, UUID userId);

    List<ActivityTemplate> findByUserIdOrderByCreatedAtAsc(UUID userId);

    long countByUserId(UUID userId);

    /** Recurring templates whose next run is on or before {@code date} (the caller checks each user's own today). */
    @Query("select t.id from ActivityTemplate t where t.nextRunOn is not null and t.nextRunOn <= :date")
    List<UUID> dueOnOrBefore(@Param("date") LocalDate date);
}
