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

    @Query("""
            select f from EmissionFactor f
            order by f.category, f.subtype, coalesce(f.region, ''), f.version desc
            """)
    List<EmissionFactor> findAllForAdmin();

    /** Every version of one factor line (same category, subtype and region), newest first. */
    @Query("""
            select f from EmissionFactor f
            where f.category = :category and f.subtype = :subtype
              and ((:region is null and f.region is null) or f.region = :region)
            order by f.version desc
            """)
    List<EmissionFactor> findLine(@Param("category") Category category, @Param("subtype") String subtype,
            @Param("region") String region);
}
