package com.co2tracker.nexus;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class NexusDtos {

    private NexusDtos() {
    }

    /** One new user message; the server holds the history. No conversationId starts a new chat. */
    public record ChatRequest(UUID conversationId, @NotBlank @Size(max = 2000) String message) {
    }

    public record MessageView(UUID id, String role, String content, Short rating, Instant createdAt) {

        static MessageView of(NexusMessage m) {
            return new MessageView(m.getId(), m.getRole(), m.getContent(), m.getRating(), m.getCreatedAt());
        }
    }

    public record ChatResponse(UUID conversationId, MessageView userMessage, MessageView reply) {
    }

    public record ConversationSummary(UUID id, String title, Instant updatedAt) {
    }

    public record ConversationDetail(UUID id, String title, List<MessageView> messages) {
    }

    /** 1 = helpful, -1 = not helpful, 0 = clear. */
    public record RatingRequest(@NotNull @Min(-1) @Max(1) Integer rating, @Size(max = 300) String note) {
    }

    public record MemoryView(String notes, boolean autoUpdate, Instant updatedAt) {
    }

    public record MemoryRequest(@NotNull @Size(max = 1500) String notes, Boolean autoUpdate) {
    }

    public record Status(boolean enabled) {
    }
}
