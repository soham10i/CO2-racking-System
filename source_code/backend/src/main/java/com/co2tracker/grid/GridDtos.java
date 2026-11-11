package com.co2tracker.grid;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class GridDtos {

    private GridDtos() {
    }

    public enum Level { GREEN, YELLOW, RED }

    /** {@code source} is ENERGY_CHARTS or FALLBACK; a fallback has no points and no best window. */
    public record GridSignal(String source, boolean substitute, List<Point> points, Window bestWindow,
            String attribution) {
    }

    /** One 15-minute step starting at {@code at}; the share is the renewable share of load in percent. */
    public record Point(Instant at, BigDecimal renewableShare, Level level) {
    }

    /** {@code to} is exclusive: the end of the last 15-minute step. */
    public record Window(Instant from, Instant to, BigDecimal avgShare) {
    }
}
