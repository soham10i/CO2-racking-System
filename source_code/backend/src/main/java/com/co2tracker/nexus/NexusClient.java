package com.co2tracker.nexus;

import java.io.IOException;
import java.util.List;

/** The Hermes agent behind Nexus. Swapped for a mock in tests. */
public interface NexusClient {

    record Turn(String role, String content) {
    }

    record Reply(String content, String model) {
    }

    boolean enabled();

    Reply complete(List<Turn> turns) throws IOException, InterruptedException;
}
