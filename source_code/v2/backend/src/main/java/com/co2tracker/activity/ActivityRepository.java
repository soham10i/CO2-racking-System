package com.co2tracker.activity;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Write model. Totals are read from the daily_emission projection, not aggregated here. */
public interface ActivityRepository extends JpaRepository<Activity, UUID>, JpaSpecificationExecutor<Activity> {

    /** Every lookup of a single activity is scoped by owner: a foreign id is indistinguishable from a missing one. */
    Optional<Activity> findByIdAndUserId(UUID id, UUID userId);

    long countByUserId(UUID userId);

    List<Activity> findByUserIdAndOccurredOnBetween(UUID userId, LocalDate from, LocalDate to);

    /** The first day the user logged anything (including zero-emission trips); null if nothing is logged. */
    @Query("select min(a.occurredOn) from Activity a where a.userId = :userId")
    LocalDate firstDay(@Param("userId") UUID userId);
}
