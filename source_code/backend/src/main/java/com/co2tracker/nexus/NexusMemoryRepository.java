package com.co2tracker.nexus;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NexusMemoryRepository extends JpaRepository<NexusMemory, UUID> {
}
