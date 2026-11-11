package com.co2tracker.analytics;

import com.co2tracker.analytics.AnalyticsDtos.Bucket;
import com.co2tracker.analytics.DailyEmissionRepository.DayRow;
import com.co2tracker.emission.Category;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Pure bucketing: every bucket in range is present (zero-filled) so charts never interpolate over gaps. */
final class TrendBuilder {

    private TrendBuilder() {
    }

    static List<Bucket> build(LocalDate from, LocalDate to, Granularity g, List<DayRow> rows) {
        Map<LocalDate, Map<Category, BigDecimal>> sums = new LinkedHashMap<>();
        for (LocalDate s = g.start(from); !s.isAfter(to); s = g.next(s)) {
            sums.put(s, DailyEmissionRepository.zeroes());
        }
        for (DayRow r : rows) {
            Map<Category, BigDecimal> bucket = sums.get(g.start(r.day()));
            if (bucket != null) {
                bucket.merge(r.category(), r.kgCo2e(), BigDecimal::add);
            }
        }
        List<Bucket> out = new ArrayList<>(sums.size());
        sums.forEach((start, byCategory) -> {
            LocalDate clippedStart = start.isBefore(from) ? from : start;
            LocalDate end = g.next(start).minusDays(1);
            LocalDate clippedEnd = end.isAfter(to) ? to : end;
            BigDecimal total = byCategory.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            out.add(new Bucket(clippedStart, clippedEnd, total, byCategory));
        });
        return out;
    }
}
