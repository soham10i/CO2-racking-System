package com.co2tracker.grid;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Fraunhofer ISE Energy-Charts traffic-light signal for Germany. The URL is a constant on purpose: the server
 * never calls a host that a user or a setting could choose (docs/11 section 2).
 */
@Component
class EnergyChartsFetcher implements GridSignalFetcher {

    static final URI URL = URI.create("https://api.energy-charts.info/signal?country=de");

    private final Duration timeout;
    private final HttpClient http;

    EnergyChartsFetcher(@Value("${app.grid.timeout:3s}") Duration timeout) {
        this.timeout = timeout;
        this.http = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @Override
    public String fetch() throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder(URL).timeout(timeout).header("Accept", "application/json").GET()
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new IOException("Energy-Charts returned HTTP " + res.statusCode());
        }
        return res.body();
    }
}
