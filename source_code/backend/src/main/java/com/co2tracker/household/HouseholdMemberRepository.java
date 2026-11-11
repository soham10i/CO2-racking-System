package com.co2tracker.household;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HouseholdMemberRepository extends JpaRepository<HouseholdMember, UUID> {

    List<HouseholdMember> findByHouseholdIdOrderByJoinedAtAsc(UUID householdId);

    long countByHouseholdId(UUID householdId);
}
