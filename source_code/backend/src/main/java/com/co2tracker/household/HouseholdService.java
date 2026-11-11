package com.co2tracker.household;

import com.co2tracker.common.ApiException;
import com.co2tracker.common.TokenUtil;
import com.co2tracker.household.HouseholdDtos.HouseholdResponse;
import com.co2tracker.household.HouseholdDtos.InviteResponse;
import com.co2tracker.household.HouseholdDtos.MemberDto;
import com.co2tracker.household.HouseholdMember.Role;
import com.co2tracker.notification.Notification.Kind;
import com.co2tracker.notification.NotificationService;
import com.co2tracker.user.UserProfile;
import com.co2tracker.user.UserProfileRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Households let people who share a home split shared entries (heating, electricity, waste). Membership changes
 * never rewrite history: entries already split stay as they were booked.
 */
@Service
@Transactional
public class HouseholdService {

    public static final int MAX_MEMBERS = 10;
    static final Duration INVITE_TTL = Duration.ofDays(7);
    // No 0/O/1/I: codes are read aloud and typed on phones.
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final HouseholdRepository households;
    private final HouseholdMemberRepository members;
    private final HouseholdInviteRepository invites;
    private final UserProfileRepository profiles;
    private final NotificationService notifications;
    private final Clock clock;

    public HouseholdService(HouseholdRepository households, HouseholdMemberRepository members,
            HouseholdInviteRepository invites, UserProfileRepository profiles, NotificationService notifications,
            Clock clock) {
        this.households = households;
        this.members = members;
        this.invites = invites;
        this.profiles = profiles;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<HouseholdResponse> mine(UUID userId) {
        return members.findById(userId).map(m -> response(m.getHouseholdId(), userId));
    }

    /** The user ids of everyone in the user's household, the user first; just the user when not in one. */
    @Transactional(readOnly = true)
    public List<UUID> memberIds(UUID userId) {
        return members.findById(userId)
                .map(m -> members.findByHouseholdIdOrderByJoinedAtAsc(m.getHouseholdId()).stream()
                        .map(HouseholdMember::getUserId)
                        .sorted((a, b) -> a.equals(userId) ? -1 : b.equals(userId) ? 1 : 0)
                        .toList())
                .orElse(List.of(userId));
    }

    public HouseholdResponse create(UUID userId, String name) {
        requireNoHousehold(userId);
        Household h = new Household();
        h.setId(UUID.randomUUID());
        h.setName(name.strip());
        h.setCreatedAt(clock.instant());
        households.save(h);
        addMember(h.getId(), userId, Role.OWNER);
        return response(h.getId(), userId);
    }

    public HouseholdResponse rename(UUID userId, String name) {
        HouseholdMember m = membership(userId);
        Household h = households.findById(m.getHouseholdId()).orElseThrow();
        h.setName(name.strip());
        return response(h.getId(), userId);
    }

    /** Any member can invite. The plain code is returned once and never stored. */
    public InviteResponse invite(UUID userId) {
        HouseholdMember m = membership(userId);
        if (members.countByHouseholdId(m.getHouseholdId()) >= MAX_MEMBERS) {
            throw ApiException.unprocessable("household_full", "A household has at most " + MAX_MEMBERS + " members");
        }
        Instant now = clock.instant();
        invites.deleteExpired(now);
        String code = newCode();
        HouseholdInvite i = new HouseholdInvite();
        i.setId(UUID.randomUUID());
        i.setHouseholdId(m.getHouseholdId());
        i.setCodeHash(TokenUtil.sha256(normalise(code)));
        i.setCreatedBy(userId);
        i.setCreatedAt(now);
        i.setExpiresAt(now.plus(INVITE_TTL));
        invites.save(i);
        return new InviteResponse(code, i.getExpiresAt());
    }

    public HouseholdResponse join(UUID userId, String code) {
        requireNoHousehold(userId);
        HouseholdInvite i = invites.findByCodeHash(TokenUtil.sha256(normalise(code)))
                .filter(x -> x.getExpiresAt().isAfter(clock.instant()))
                .orElseThrow(() -> ApiException.unprocessable("invalid_invite", "This invite code is invalid or has expired"));
        if (members.countByHouseholdId(i.getHouseholdId()) >= MAX_MEMBERS) {
            throw ApiException.unprocessable("household_full", "A household has at most " + MAX_MEMBERS + " members");
        }
        invites.delete(i);
        String name = profiles.findById(userId).map(UserProfile::getDisplayName).orElse("");
        for (HouseholdMember other : members.findByHouseholdIdOrderByJoinedAtAsc(i.getHouseholdId())) {
            boolean de = profiles.findById(other.getUserId()).map(p -> "de".equals(p.getLocale())).orElse(false);
            notifications.notify(other.getUserId(), Kind.HOUSEHOLD, "household-join-" + i.getId(),
                    de ? "Neues Haushaltsmitglied" : "New household member",
                    de ? name + " ist deinem Haushalt beigetreten." : name + " joined your household.",
                    "/household");
        }
        addMember(i.getHouseholdId(), userId, Role.MEMBER);
        return response(i.getHouseholdId(), userId);
    }

    /** Leaving keeps every entry already split. The last member out deletes the household. */
    public void leave(UUID userId) {
        HouseholdMember m = membership(userId);
        members.delete(m);
        members.flush();
        List<HouseholdMember> rest = members.findByHouseholdIdOrderByJoinedAtAsc(m.getHouseholdId());
        if (rest.isEmpty()) {
            households.deleteById(m.getHouseholdId());
        } else if (m.getRole() == Role.OWNER && rest.stream().noneMatch(r -> r.getRole() == Role.OWNER)) {
            rest.get(0).setRole(Role.OWNER); // the longest-standing member takes over
        }
    }

    // ---- helpers -----------------------------------------------------------------------------

    private HouseholdResponse response(UUID householdId, UUID me) {
        Household h = households.findById(householdId).orElseThrow();
        List<MemberDto> list = members.findByHouseholdIdOrderByJoinedAtAsc(householdId).stream()
                .map(m -> new MemberDto(profiles.findById(m.getUserId()).map(UserProfile::getDisplayName).orElse("?"),
                        m.getRole(), m.getJoinedAt(), m.getUserId().equals(me)))
                .toList();
        return new HouseholdResponse(h.getId(), h.getName(), list, MAX_MEMBERS);
    }

    private void addMember(UUID householdId, UUID userId, Role role) {
        HouseholdMember m = new HouseholdMember();
        m.setUserId(userId);
        m.setHouseholdId(householdId);
        m.setRole(role);
        m.setJoinedAt(clock.instant());
        members.save(m);
    }

    private HouseholdMember membership(UUID userId) {
        return members.findById(userId).orElseThrow(() -> ApiException.notFound("You are not in a household"));
    }

    private void requireNoHousehold(UUID userId) {
        if (members.existsById(userId)) {
            throw new ApiException(HttpStatus.CONFLICT, "already_in_household", "Leave your current household first");
        }
    }

    private static String newCode() {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            if (i == 5) {
                s.append('-');
            }
            s.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return s.toString();
    }

    private static String normalise(String code) {
        return code.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }
}
