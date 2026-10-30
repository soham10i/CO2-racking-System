package com.co2tracker.emission;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmissionFactorRepository extends JpaRepository<EmissionFactor, UUID> {

    /** Factors valid on {@code date} that are global or specific to {@code region} (never null; "" = none). */
    @Query("""
            select f from EmissionFactor f
            where (f.region is null or f.region = :region)
              and f.validFrom <= :date and (f.validTo is null or f.validTo > :date)
            """)
    List<EmissionFactor> findValid(@Param("date") LocalDate date, @Param("region") String region);
}
