package com.co2tracker.grid;

import com.co2tracker.grid.GridDtos.GridSignal;
import com.co2tracker.grid.GridDtos.Level;
import com.co2tracker.grid.GridDtos.Point;
import com.co2tracker.grid.GridDtos.Window;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The German grid's renewable share for today, used only for timing advice; footprint accounting keeps the
 * annual factor (docs/11 section 2). Successful responses are cached in memory; any failure yields the fallback
 * shape so the plan still works without timing advice.
 */
@Service
public class GridSignalService {

    public static final String ATTRIBUTION = "Energy-Charts, Fraunhofer ISE";
    static final Duration STEP = Duration.ofMinutes(15);
    /** The best window must cover at least two hours of 15-minute steps. */
    static final int MIN_WINDOW_STEPS = 8;
    /**
     * Operational setting, not an emission number: after a failed fetch, serve the fallback for this long
     * instead of retrying, so a slow or down upstream cannot hold every request for the full timeout.
     */
    static final Duration FAILURE_BACKOFF = Duration.ofMinutes(1);

    private static final Logger log = LoggerFactory.getLogger(GridSignalService.class);

    private record Cached(Instant fetchedAt, boolean substitute, List<Point> points) {
    }

    private final GridSignalFetcher fetcher;
    private final ObjectMapper json;
    private final Clock clock;
    private final boolean enabled;
    private final Duration ttl;
    private final Object lock = new Object();
    private volatile Cached cached;
    private volatile Instant failedAt;

    public GridSignalService(GridSignalFetcher fetcher, ObjectMapper json, Clock clock,
            @Value("${app.grid.enabled:true}") boolean enabled, @Value("${app.grid.cache-ttl:15m}") Duration ttl) {
        this.fetcher = fetcher;
        this.json = json;
        this.clock = clock;
        this.enabled = enabled;
        this.ttl = ttl;
    }

    public GridSignal current() {
        if (!enabled) {
            return fallback();
        }
        Instant now = clock.instant();
        Cached c = fresh(cached, now);
        if (c == null) {
            if (backingOff(now)) {
                return fallback();
            }
            synchronized (lock) { // one upstream call per expiry, however many requests are waiting
                c = fresh(cached, now);
                if (c == null) {
                    if (backingOff(now)) {
                        return fallback();
                    }
                    c = load(now);
                    if (c == null) {
                        failedAt = now;
                        return fallback();
                    }
                    failedAt = null;
                    cached = c;
                }
            }
        }
        return new GridSignal("ENERGY_CHARTS", c.substitute(), c.points(), bestWindow(c.points(), now), ATTRIBUTION);
    }

    /** Drops the cached signal (tests; the next request fetches again). */
    public void evict() {
        cached = null;
        failedAt = null;
    }

    public static GridSignal fallback() {
        return new GridSignal("FALLBACK", false, List.of(), null, ATTRIBUTION);
    }

    /**
     * The contiguous stretch of at least two hours with the highest mean share, among the steps that have not
     * ended yet; null if less than two hours of data remain. A missing step breaks contiguity.
     */
    static Window bestWindow(List<Point> points, Instant now) {
        List<Point> ahead = points.stream().filter(p -> p.at().plus(STEP).isAfter(now)).toList();
        Window best = null;
        double bestMean = Double.NEGATIVE_INFINITY;
        for (int i = 0; i < ahead.size(); i++) {
            double sum = 0;
            for (int j = i; j < ahead.size(); j++) {
                if (j > i && !ahead.get(j).at().equals(ahead.get(j - 1).at().plus(STEP))) {
                    break;
                }
                sum += ahead.get(j).renewableShare().doubleValue();
                int n = j - i + 1;
                if (n >= MIN_WINDOW_STEPS && sum / n > bestMean) {
                    bestMean = sum / n;
                    best = new Window(ahead.get(i).at(), ahead.get(j).at().plus(STEP),
                            BigDecimal.valueOf(bestMean).setScale(1, RoundingMode.HALF_EVEN));
                }
            }
        }
        return best;
    }

    // ---- helpers -----------------------------------------------------------------------------

    private boolean backingOff(Instant now) {
        Instant f = failedAt;
        return f != null && f.plus(FAILURE_BACKOFF).isAfter(now);
    }

    private Cached fresh(Cached c, Instant now) {
        return c != null && c.fetchedAt().plus(ttl).isAfter(now) ? c : null;
    }

    private Cached load(Instant now) {
        try {
            String body = fetcher.fetch();
            if (body == null) {
                throw new IllegalStateException("empty response");
            }
            return parse(json.readTree(body), now);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Grid signal unavailable, using fallback: {}", e.toString());
        }
        return null;
    }

    /** Steps without a share are skipped; mismatched array lengths are rejected as a bad response. */
    private static Cached parse(JsonNode root, Instant now) {
        JsonNode times = root.path("unix_seconds");
        JsonNode shares = root.path("share");
        JsonNode signals = root.path("signal");
        if (!times.isArray() || times.size() != shares.size() || times.size() != signals.size()) {
            throw new IllegalStateException("unexpected signal shape");
        }
        List<Point> points = new ArrayList<>();
        for (int i = 0; i < times.size(); i++) {
            if (!times.get(i).isNumber() || !shares.get(i).isNumber()) {
                continue;
            }
            points.add(new Point(Instant.ofEpochSecond(times.get(i).asLong()),
                    shares.get(i).decimalValue().setScale(1, RoundingMode.HALF_EVEN), level(signals.get(i).asInt())));
        }
        return new Cached(now, root.path("substitute").asBoolean(false), List.copyOf(points));
    }

    private static Level level(int signal) {
        return switch (signal) {
            case 2 -> Level.GREEN;
            case 1 -> Level.YELLOW;
            default -> Level.RED;
        };
    }
}
