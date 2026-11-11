package com.co2tracker.activity;

import java.math.BigDecimal;
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

    long countByFactorIdAndOccurredOnGreaterThanEqual(UUID factorId, java.time.LocalDate from);

    List<Activity> findByShareGroupId(UUID shareGroupId);

    List<Activity> findByUserIdAndOccurredOnBetween(UUID userId, LocalDate from, LocalDate to);

    List<Activity> findByUserIdOrderByOccurredOnAscCreatedAtAsc(UUID userId);

    /** The first day the user logged anything (including zero-emission trips); null if nothing is logged. */
    @Query("select min(a.occurredOn) from Activity a where a.userId = :userId")
    LocalDate firstDay(@Param("userId") UUID userId);

    interface QuantitySum {
        BigDecimal getQuantity();

        BigDecimal getKg();
    }

    /** Summed quantity and booked kg of one subtype over a date range (e.g. grid electricity for Scope 2). */
    @Query("select coalesce(sum(a.quantity), 0) as quantity, coalesce(sum(a.kgCo2e), 0) as kg from Activity a"
            + " where a.userId = :userId and a.subtype = :subtype and a.occurredOn between :from and :to")
    QuantitySum sumBySubtype(@Param("userId") UUID userId, @Param("subtype") String subtype,
            @Param("from") LocalDate from, @Param("to") LocalDate to);
}
