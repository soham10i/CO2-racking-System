package com.co2tracker.nexus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NexusConversationRepository extends JpaRepository<NexusConversation, UUID> {

    List<NexusConversation> findByUserIdOrderByUpdatedAtDesc(UUID userId, Pageable page);

    Optional<NexusConversation> findByIdAndUserId(UUID id, UUID userId);
}
