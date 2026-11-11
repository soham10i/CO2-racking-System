package com.co2tracker.notification;

import com.co2tracker.config.AppProperties;
import io.jsonwebtoken.Jwts;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Web push with the JDK only: payload encryption per RFC 8291 (aes128gcm, RFC 8188) and VAPID per RFC 8292.
 * The server only posts to push services on the allowlist, so a stored endpoint can never point it elsewhere.
 */
@Component
public class WebPushSender {

    public enum Result { SENT, GONE, FAILED }

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);
    private static final int RECORD_SIZE = 4096;
    private static final Base64.Decoder B64 = Base64.getUrlDecoder();
    private static final Base64.Encoder B64_OUT = Base64.getUrlEncoder().withoutPadding();

    private final AppProperties.Push config;
    private final Clock clock;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final SecureRandom random = new SecureRandom();
    private final ECParameterSpec p256;
    private final PrivateKey vapidPrivate;

    public WebPushSender(AppProperties props, Clock clock) {
        this.config = props.push();
        this.clock = clock;
        this.p256 = p256();
        this.vapidPrivate = config != null && config.enabled() ? privateKey(B64.decode(config.privateKey())) : null;
    }

    public boolean enabled() {
        return vapidPrivate != null;
    }

    public String publicKey() {
        return enabled() ? config.publicKey() : null;
    }

    /** True if the endpoint is https on an allowlisted push service (suffix match on the host). */
    public boolean allowed(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            String host = uri.getHost();
            if (!"https".equals(uri.getScheme()) || host == null || uri.getUserInfo() != null || uri.getPort() != -1) {
                return false;
            }
            String h = host.toLowerCase();
            return config != null && config.allowedHosts() != null
                    && config.allowedHosts().stream().anyMatch(a -> h.equals(a) || h.endsWith("." + a));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    public Result send(PushSubscription s, String json) {
        if (!enabled() || !allowed(s.getEndpoint())) {
            return Result.FAILED;
        }
        try {
            byte[] body = encrypt(json.getBytes(StandardCharsets.UTF_8), B64.decode(s.getP256dh()), B64.decode(s.getAuth()));
            URI uri = URI.create(s.getEndpoint());
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(10))
                    .header("TTL", "86400")
                    .header("Urgency", "normal")
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("Authorization", "vapid t=" + vapidJwt(uri) + ", k=" + config.publicKey())
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            int status = http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status == 404 || status == 410) {
                return Result.GONE;
            }
            if (status >= 300) {
                log.warn("Push service answered {}", status);
                return Result.FAILED;
            }
            return Result.SENT;
        } catch (Exception e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("Push failed: {}", e.toString());
            return Result.FAILED;
        }
    }

    private String vapidJwt(URI endpoint) {
        String aud = endpoint.getScheme() + "://" + endpoint.getHost();
        return Jwts.builder()
                .claim("aud", aud)
                .expiration(Date.from(clock.instant().plus(Duration.ofHours(12))))
                .subject(config.subject())
                .signWith(vapidPrivate, Jwts.SIG.ES256)
                .compact();
    }

    // ---- RFC 8291 -----------------------------------------------------------------------------

    /** Encrypts one record for the browser key {@code uaPublic} (65-byte uncompressed point) and {@code authSecret}. */
    byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret) throws GeneralSecurityException {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"), random);
        KeyPair ephemeral = gen.generateKeyPair();
        byte[] asPublic = encodePoint((ECPublicKey) ephemeral.getPublic());
        byte[] salt = new byte[16];
        random.nextBytes(salt);
        return encrypt(plaintext, uaPublic, authSecret, ephemeral.getPrivate(), asPublic, salt);
    }

    byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret, PrivateKey asPrivate, byte[] asPublic,
            byte[] salt) throws GeneralSecurityException {
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(asPrivate);
        ka.doPhase(publicKey(uaPublic), true);
        byte[] ecdh = ka.generateSecret();

        byte[][] keys = deriveKeys(ecdh, authSecret, uaPublic, asPublic, salt);
        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keys[0], "AES"), new GCMParameterSpec(128, keys[1]));
        byte[] padded = Arrays.copyOf(plaintext, plaintext.length + 1);
        padded[plaintext.length] = 0x02; // last-record delimiter
        byte[] cipher = aes.doFinal(padded);

        ByteBuffer out = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length + cipher.length);
        out.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic).put(cipher);
        return out.array();
    }

    /** Returns {content-encryption key (16 bytes), nonce (12 bytes)}; shared by encryption and its test. */
    static byte[][] deriveKeys(byte[] ecdh, byte[] authSecret, byte[] uaPublic, byte[] asPublic, byte[] salt)
            throws GeneralSecurityException {
        byte[] prkKey = hmac(authSecret, ecdh);
        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[] {1});
        byte[] ikm = hmac(prkKey, keyInfo);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, concat("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII),
                new byte[] {1})), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, concat("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII),
                new byte[] {1})), 12);
        return new byte[][] {cek, nonce};
    }

    private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] p : parts) {
            out.writeBytes(p);
        }
        return out.toByteArray();
    }

    // ---- P-256 keys -----------------------------------------------------------------------------

    static byte[] encodePoint(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 0x04;
        copyFixed(key.getW().getAffineX(), out, 1);
        copyFixed(key.getW().getAffineY(), out, 33);
        return out;
    }

    private static void copyFixed(BigInteger v, byte[] out, int offset) {
        byte[] raw = v.toByteArray();
        int len = Math.min(raw.length, 32);
        System.arraycopy(raw, raw.length - len, out, offset + 32 - len, len);
    }

    PublicKey publicKey(byte[] point) throws GeneralSecurityException {
        if (point.length != 65 || point[0] != 0x04) {
            throw new GeneralSecurityException("Expected an uncompressed P-256 point");
        }
        ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(point, 1, 33)),
                new BigInteger(1, Arrays.copyOfRange(point, 33, 65)));
        return KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, p256));
    }

    private PrivateKey privateKey(byte[] d) {
        try {
            return KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d), p256));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("VAPID_PRIVATE_KEY is not a P-256 private key", e);
        }
    }

    private static ECParameterSpec p256() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
            gen.initialize(new ECGenParameterSpec("secp256r1"));
            return ((ECPublicKey) gen.generateKeyPair().getPublic()).getParams();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static String b64(byte[] bytes) {
        return B64_OUT.encodeToString(bytes);
    }
}
