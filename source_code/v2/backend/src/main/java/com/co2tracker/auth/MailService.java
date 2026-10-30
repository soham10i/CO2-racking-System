package com.co2tracker.auth;

import com.co2tracker.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final AppProperties props;

    public MailService(JavaMailSender sender, AppProperties props) {
        this.sender = sender;
        this.props = props;
    }

    public void sendVerification(String to, String token) {
        send(to, "Confirm your CO2 Tracker account",
                "Welcome to CO2 Tracker!\n\nConfirm your email: " + props.frontendUrl()
                        + "/verify-email?token=" + token + "\n\nThis link expires in 24 hours.");
    }

    public void sendPasswordReset(String to, String token) {
        send(to, "Reset your CO2 Tracker password",
                "Reset your password: " + props.frontendUrl() + "/reset-password?token=" + token
                        + "\n\nThis link expires in 30 minutes. If you did not ask for it, ignore this email.");
    }

    public void sendWeeklyDigest(String to, String subject, String text) {
        send(to, subject, text + "\n\nSee your dashboard: " + props.frontendUrl()
                + "/\nTurn this email off in Settings: " + props.frontendUrl() + "/settings");
    }

    private void send(String to, String subject, String text) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(props.mailFrom());
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(text);
        try {
            sender.send(msg);
        } catch (MailException e) {
            // Never fail the request (and never reveal account existence) because mail is down.
            log.warn("Could not send '{}' mail: {}", subject, e.getClass().getSimpleName());
        }
    }
}
