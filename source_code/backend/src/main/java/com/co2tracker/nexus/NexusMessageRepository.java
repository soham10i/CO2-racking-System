package com.co2tracker.nexus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NexusMessageRepository extends JpaRepository<NexusMessage, UUID> {

    List<NexusMessage> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);

    long countByConversationIdAndRole(UUID conversationId, String role);

    /** A message only if it sits in one of this user's conversations. */
    @Query("""
            select m from NexusMessage m, NexusConversation c
            where m.id = :id and c.id = m.conversationId and c.userId = :userId
            """)
    Optional<NexusMessage> findOwned(@Param("id") UUID id, @Param("userId") UUID userId);

    /** Answers this user marked unhelpful, newest first. */
    @Query("""
            select m from NexusMessage m, NexusConversation c
            where c.id = m.conversationId and c.userId = :userId and m.rating = -1
            order by m.createdAt desc
            """)
    List<NexusMessage> findDisliked(@Param("userId") UUID userId, Pageable page);
}
