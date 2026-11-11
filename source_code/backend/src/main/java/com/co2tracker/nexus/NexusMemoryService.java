package com.co2tracker.nexus;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The adaptive part of Nexus: after every few questions it asks the model to rewrite a short list of durable facts
 * about the user (goals, constraints, preferences). The list lives in Postgres, is shown to the user, can be edited
 * or switched off, and is fed back into every later prompt.
 */
@Service
public class NexusMemoryService {

    static final int EVERY_N_QUESTIONS = 3;
    static final int MAX_CHARS = 1500;
    static final String NO_CHANGE = "NO_CHANGE";

    static final String PROMPT = """
            You maintain short memory notes about a user of a personal CO2 tracking app. Keep only durable facts \
            that help give better advice later: goals, constraints (e.g. no car, lives rurally, shift work), diet \
            and travel preferences, things they already tried or rejected. Do NOT store figures from their logged \
            data (the app supplies those fresh), health details, religion, politics, exact addresses or anything \
            they did not say themselves. At most 8 short bullet points, under 1200 characters. Reply with the full \
            updated notes only, or exactly NO_CHANGE if nothing new is worth keeping.""";

    private static final Logger log = LoggerFactory.getLogger(NexusMemoryService.class);

    private final NexusClient client;
    private final NexusMemoryRepository memories;
    private final NexusMessageRepository messages;
    private final Clock clock;
    private final Executor executor;

    public NexusMemoryService(NexusClient client, NexusMemoryRepository memories, NexusMessageRepository messages,
            Clock clock, @Value("${app.nexus.memory-async:true}") boolean async) {
        this.client = client;
        this.memories = memories;
        this.messages = messages;
        this.clock = clock;
        this.executor = async ? Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "nexus-memory");
            t.setDaemon(true);
            return t;
        }) : Runnable::run;
    }

    public Optional<NexusMemory> find(UUID userId) {
        return memories.findById(userId);
    }

    /** Called after each answer; refreshes the notes every N user questions in a conversation. */
    void afterAnswer(UUID userId, UUID conversationId) {
        boolean auto = memories.findById(userId).map(NexusMemory::isAutoUpdate).orElse(true);
        long asked = messages.countByConversationIdAndRole(conversationId, "user");
        if (auto && asked % EVERY_N_QUESTIONS == 0) {
            executor.execute(() -> refresh(userId, conversationId));
        }
    }

    void refresh(UUID userId, UUID conversationId) {
        try {
            String current = memories.findById(userId).map(NexusMemory::getNotes).orElse("(none yet)");
            List<NexusMessage> all = messages.findByConversationIdOrderByCreatedAtAsc(conversationId);
            StringBuilder chat = new StringBuilder();
            all.subList(Math.max(0, all.size() - 8), all.size()).forEach(m -> chat.append(m.getRole())
                    .append(": ").append(m.getContent(), 0, Math.min(m.getContent().length(), 1200)).append('\n'));
            NexusClient.Reply r = client.complete(List.of(new NexusClient.Turn("system", PROMPT),
                    new NexusClient.Turn("user", "Current notes:\n" + current + "\n\nRecent conversation:\n" + chat)));
            String notes = r.content().strip();
            if (notes.isEmpty() || notes.startsWith(NO_CHANGE) || notes.contains("Provider said: HTTP")) {
                return;
            }
            save(userId, notes, null);
        } catch (Exception e) {
            log.warn("Nexus memory refresh failed: {}", e.getClass().getSimpleName());
        }
    }

    NexusMemory save(UUID userId, String notes, Boolean autoUpdate) {
        NexusMemory m = memories.findById(userId).orElseGet(() -> {
            NexusMemory n = new NexusMemory();
            n.setUserId(userId);
            return n;
        });
        String clean = notes.strip();
        m.setNotes(clean.length() > MAX_CHARS ? clean.substring(0, MAX_CHARS) : clean);
        if (autoUpdate != null) {
            m.setAutoUpdate(autoUpdate);
        }
        m.setUpdatedAt(clock.instant());
        return memories.save(m);
    }

    void forget(UUID userId) {
        memories.deleteById(userId);
    }
}
