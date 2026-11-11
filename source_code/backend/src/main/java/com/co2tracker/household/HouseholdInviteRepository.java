package com.co2tracker.household;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HouseholdInviteRepository extends JpaRepository<HouseholdInvite, UUID> {

    Optional<HouseholdInvite> findByCodeHash(String codeHash);

    @Modifying
    @Query("delete from HouseholdInvite i where i.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
