package com.co2tracker.household;

import com.co2tracker.household.HouseholdMember.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class HouseholdDtos {

    private HouseholdDtos() {
    }

    /** Members are shown by display name only: no emails are shared inside a household. */
    public record MemberDto(String displayName, Role role, Instant joinedAt, boolean me) {
    }

    public record HouseholdResponse(UUID id, String name, List<MemberDto> members, int maxMembers) {
    }

    public record CreateRequest(@NotBlank @Size(max = 60) String name) {
    }

    public record InviteResponse(String code, Instant expiresAt) {
    }

    public record JoinRequest(@NotBlank @Size(max = 64) String code) {
    }
}
