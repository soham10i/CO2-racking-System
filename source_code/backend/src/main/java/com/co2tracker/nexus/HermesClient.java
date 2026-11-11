package com.co2tracker.nexus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Calls the Hermes agent's OpenAI-compatible chat endpoint. Hermes in turn calls Mercury (Inception Labs) with
 * the Mercury key, which only the Hermes container holds. The URL comes from the operator's config, never from a
 * request.
 */
@Component
class HermesClient implements NexusClient {

    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final Duration timeout;
    private final ObjectMapper json;
    private final HttpClient http;

    HermesClient(@Value("${app.nexus.url:}") String baseUrl, @Value("${app.nexus.api-key:}") String apiKey,
            @Value("${app.nexus.model:hermes-agent}") String model,
            @Value("${app.nexus.timeout:60s}") Duration timeout, ObjectMapper json) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        this.apiKey = apiKey;
        this.model = model;
        this.timeout = timeout;
        this.json = json;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Override
    public boolean enabled() {
        return !baseUrl.isBlank();
    }

    @Override
    public Reply complete(List<Turn> turns) throws IOException, InterruptedException {
        byte[] body = json.writeValueAsBytes(Map.of("model", model, "stream", false, "messages", turns));
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(baseUrl + "/v1/chat/completions"))
                .timeout(timeout).header("Content-Type", "application/json").header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(body));
        if (apiKey != null && !apiKey.isBlank()) {
            req.header("Authorization", "Bearer " + apiKey);
        }
        HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new IOException("Hermes returned HTTP " + res.statusCode());
        }
        JsonNode root = json.readTree(res.body());
        String content = root.at("/choices/0/message/content").asText("");
        if (content.isBlank()) {
            throw new IOException("Hermes returned an empty answer");
        }
        // Hermes reports provider failures (bad model, 4xx/5xx from Mercury) as a normal 200 answer.
        if (content.contains("Provider said: HTTP")) {
            throw new IOException("Mercury error relayed by Hermes");
        }
        return new Reply(content, root.path("model").asText(model));
    }
}
