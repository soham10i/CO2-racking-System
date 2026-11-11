package com.co2tracker.grid;

import static org.assertj.core.api.Assertions.assertThat;

import com.co2tracker.grid.GridDtos.GridSignal;
import com.co2tracker.grid.GridDtos.Level;
import com.co2tracker.grid.GridDtos.Point;
import com.co2tracker.grid.GridDtos.Window;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class GridSignalServiceTest {

    private static final Instant T0 = Instant.parse("2026-11-09T00:00:00Z");

    /** Points every 15 minutes from T0 with the given shares. */
    private static List<Point> points(double... shares) {
        List<Point> list = new ArrayList<>();
        for (int i = 0; i < shares.length; i++) {
            list.add(new Point(T0.plus(Duration.ofMinutes(15L * i)), BigDecimal.valueOf(shares[i]), Level.GREEN));
        }
        return list;
    }

    @Test
    void bestWindowIsTheHighestMeanStretchOfAtLeastTwoHours() {
        double[] shares = new double[24];
        java.util.Arrays.fill(shares, 20);
        for (int i = 10; i < 18; i++) {
            shares[i] = 80; // 02:30 to 04:30
        }
        Window w = GridSignalService.bestWindow(points(shares), T0);
        assertThat(w.from()).isEqualTo(Instant.parse("2026-11-09T02:30:00Z"));
        assertThat(w.to()).isEqualTo(Instant.parse("2026-11-09T04:30:00Z"));
        assertThat(w.avgShare()).isEqualByComparingTo("80.0");
    }

    @Test
    void bestWindowIgnoresThePastAndNeedsTwoHoursAhead() {
        double[] shares = new double[16];
        java.util.Arrays.fill(shares, 30);
        shares[0] = 99; // already over by 00:30
        Window w = GridSignalService.bestWindow(points(shares), T0.plus(Duration.ofMinutes(30)));
        assertThat(w.from()).isEqualTo(T0.plus(Duration.ofMinutes(30)));
        assertThat(w.avgShare()).isEqualByComparingTo("30.0");
        // 7 steps left = 1 h 45 min: no window
        assertThat(GridSignalService.bestWindow(points(shares), T0.plus(Duration.ofMinutes(135)))).isNull();
        assertThat(GridSignalService.bestWindow(List.of(), T0)).isNull();
    }

    @Test
    void fallsBackOnErrorAndCachesSuccess() {
        Clock clock = Clock.fixed(T0, ZoneOffset.UTC);
        GridSignal failed = new GridSignalService(() -> {
            throw new java.io.IOException("down");
        }, new ObjectMapper(), clock, true, Duration.ofMinutes(15)).current();
        assertThat(failed.source()).isEqualTo("FALLBACK");
        assertThat(failed.points()).isEmpty();
        assertThat(failed.bestWindow()).isNull();

        AtomicInteger calls = new AtomicInteger();
        String body = "{\"unix_seconds\":[" + T0.getEpochSecond() + "," + (T0.getEpochSecond() + 900)
                + "],\"share\":[55.25,60],\"signal\":[2,-1],\"substitute\":true}";
        GridSignalService ok = new GridSignalService(() -> {
            calls.incrementAndGet();
            return body;
        }, new ObjectMapper(), clock, true, Duration.ofMinutes(15));
        GridSignal s = ok.current();
        ok.current();
        assertThat(calls).hasValue(1);
        assertThat(s.source()).isEqualTo("ENERGY_CHARTS");
        assertThat(s.substitute()).isTrue();
        assertThat(s.points()).extracting(Point::level).containsExactly(Level.GREEN, Level.RED);
        assertThat(s.bestWindow()).isNull(); // only 30 minutes of data

        GridSignal bad = new GridSignalService(() -> "{\"unix_seconds\":[1],\"share\":[]}", new ObjectMapper(),
                clock, true, Duration.ofMinutes(15)).current();
        assertThat(bad.source()).isEqualTo("FALLBACK");
    }

    @Test
    void backsOffAfterAFailureInsteadOfRetryingEveryRequest() {
        AtomicInteger calls = new AtomicInteger();
        java.util.concurrent.atomic.AtomicReference<Instant> now = new java.util.concurrent.atomic.AtomicReference<>(T0);
        Clock clock = new Clock() {
            @Override
            public ZoneOffset getZone() {
                return ZoneOffset.UTC;
            }

            @Override
            public Clock withZone(java.time.ZoneId zone) {
                return this;
            }

            @Override
            public Instant instant() {
                return now.get();
            }
        };
        GridSignalService s = new GridSignalService(() -> {
            calls.incrementAndGet();
            throw new java.io.IOException("down");
        }, new ObjectMapper(), clock, true, Duration.ofMinutes(15));
        s.current();
        s.current();
        assertThat(calls).hasValue(1);
        now.set(T0.plus(GridSignalService.FAILURE_BACKOFF));
        assertThat(s.current().source()).isEqualTo("FALLBACK");
        assertThat(calls).hasValue(2);
    }
}
