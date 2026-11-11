package com.co2tracker.nexus;

import com.co2tracker.auth.AuthPrincipal;
import com.co2tracker.nexus.NexusDtos.ChatRequest;
import com.co2tracker.nexus.NexusDtos.ChatResponse;
import com.co2tracker.nexus.NexusDtos.ConversationDetail;
import com.co2tracker.nexus.NexusDtos.ConversationSummary;
import com.co2tracker.nexus.NexusDtos.MemoryRequest;
import com.co2tracker.nexus.NexusDtos.MemoryView;
import com.co2tracker.nexus.NexusDtos.RatingRequest;
import com.co2tracker.nexus.NexusDtos.Status;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Authenticated proxy to the Hermes agent plus the user's stored chats, ratings and memory. */
@RestController
@RequestMapping("/api/v1/nexus")
public class NexusController {

    private final NexusService nexus;
    private final NexusMemoryService memory;

    public NexusController(NexusService nexus, NexusMemoryService memory) {
        this.nexus = nexus;
        this.memory = memory;
    }

    @GetMapping("/status")
    public Status status() {
        return new Status(nexus.enabled());
    }

    @PostMapping("/chat")
    public ChatResponse chat(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody ChatRequest req) {
        return nexus.chat(p.userId(), req.conversationId(), req.message());
    }

    @GetMapping("/conversations")
    public List<ConversationSummary> conversations(@AuthenticationPrincipal AuthPrincipal p) {
        return nexus.list(p.userId());
    }

    @GetMapping("/conversations/{id}")
    public ConversationDetail conversation(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        return nexus.get(p.userId(), id);
    }

    @DeleteMapping("/conversations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        nexus.delete(p.userId(), id);
    }

    @PostMapping("/messages/{id}/rating")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rate(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id,
            @Valid @RequestBody RatingRequest req) {
        nexus.rate(p.userId(), id, req.rating(), req.note());
    }

    @GetMapping("/memory")
    public MemoryView memory(@AuthenticationPrincipal AuthPrincipal p) {
        return memory.find(p.userId()).map(m -> new MemoryView(m.getNotes(), m.isAutoUpdate(), m.getUpdatedAt()))
                .orElse(new MemoryView("", true, null));
    }

    @PutMapping("/memory")
    public MemoryView saveMemory(@AuthenticationPrincipal AuthPrincipal p, @Valid @RequestBody MemoryRequest req) {
        NexusMemory m = memory.save(p.userId(), req.notes(), req.autoUpdate());
        return new MemoryView(m.getNotes(), m.isAutoUpdate(), m.getUpdatedAt());
    }

    @DeleteMapping("/memory")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forget(@AuthenticationPrincipal AuthPrincipal p) {
        memory.forget(p.userId());
    }
}
