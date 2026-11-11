package com.co2tracker.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.co2tracker.config.AppProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class WebPushSenderTest {

    private final WebPushSender sender = new WebPushSender(new AppProperties(null, null, null,
            new AppProperties.Push(null, null, "mailto:x@example.com",
                    List.of("fcm.googleapis.com", "push.apple.com")), List.of()), Clock.systemUTC());

    /** Decrypts as the browser would (RFC 8291 §3.4) and expects the original text back. */
    @Test
    void payloadRoundTrips() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair ua = gen.generateKeyPair();
        byte[] uaPublic = WebPushSender.encodePoint((ECPublicKey) ua.getPublic());
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);

        byte[] record = sender.encrypt("{\"title\":\"Hallo\"}".getBytes(StandardCharsets.UTF_8), uaPublic, auth);

        ByteBuffer in = ByteBuffer.wrap(record);
        byte[] salt = new byte[16];
        in.get(salt);
        assertThat(in.getInt()).isEqualTo(4096);
        byte[] asPublic = new byte[in.get()];
        in.get(asPublic);
        byte[] cipher = new byte[in.remaining()];
        in.get(cipher);

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(ua.getPrivate());
        ka.doPhase(sender.publicKey(asPublic), true);
        byte[][] keys = WebPushSender.deriveKeys(ka.generateSecret(), auth, uaPublic, asPublic, salt);
        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keys[0], "AES"), new GCMParameterSpec(128, keys[1]));
        byte[] plain = aes.doFinal(cipher);

        assertThat(plain[plain.length - 1]).isEqualTo((byte) 2);
        assertThat(new String(Arrays.copyOf(plain, plain.length - 1), StandardCharsets.UTF_8))
                .isEqualTo("{\"title\":\"Hallo\"}");
    }

    @Test
    void onlyAllowlistedHttpsPushServices() {
        assertThat(sender.allowed("https://fcm.googleapis.com/fcm/send/abc")).isTrue();
        assertThat(sender.allowed("https://web.push.apple.com/QK")).isTrue();
        assertThat(sender.allowed("http://fcm.googleapis.com/x")).isFalse();
        assertThat(sender.allowed("https://evil-fcm.googleapis.com.attacker.io/x")).isFalse();
        assertThat(sender.allowed("https://169.254.169.254/latest")).isFalse();
        assertThat(sender.allowed("https://fcm.googleapis.com:8443/x")).isFalse();
        assertThat(sender.enabled()).isFalse();
    }
}
