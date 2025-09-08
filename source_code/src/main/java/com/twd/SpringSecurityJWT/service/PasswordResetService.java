package com.twd.SpringSecurityJWT.service;

import com.twd.SpringSecurityJWT.dto.PasswordResetDTO;
import com.twd.SpringSecurityJWT.dto.PasswordResetRequestDTO;
import com.twd.SpringSecurityJWT.entity.PasswordResetToken;
import com.twd.SpringSecurityJWT.entity.OurUsers;
import com.twd.SpringSecurityJWT.repository.UserRepository;
import com.twd.SpringSecurityJWT.repository.PasswordResetTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class PasswordResetService {

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private PasswordResetTokenRepository tokenRepo;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private static final String RESET_LINK_BASE_URL = "http://localhost:6060/auth/reset-password?token=";

    public String requestPasswordReset(PasswordResetRequestDTO request) {
        // Check if the user exists
        OurUsers user = userRepo.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User with the given email does not exist."));

        // Generate a reset token
        String resetToken = UUID.randomUUID().toString();

        // Save the token
        PasswordResetToken tokenEntity = new PasswordResetToken();
        tokenEntity.setToken(resetToken);
        tokenEntity.setEmail(user.getEmail());
        tokenEntity.setExpirationTime(LocalDateTime.now().plusHours(1)); // Token valid for 1 hour
        tokenRepo.save(tokenEntity);

        // Construct the reset link
        String resetLink = RESET_LINK_BASE_URL + resetToken;

        // Return the reset link as part of the response
        return "Password reset link has been sent to your email. Reset link: " + resetLink;
    }

    public String resetPassword(PasswordResetDTO request) {
        try {
            // Find the token
            PasswordResetToken tokenEntity = tokenRepo.findByToken(request.getToken())
                    .orElseThrow(() -> new IllegalArgumentException("Invalid or expired token."));

            // Check if the token is expired
            if (tokenEntity.isExpired()) {
                throw new IllegalArgumentException("Token has expired.");
            }

            // Find the user and reset the password
            OurUsers user = userRepo.findByEmail(tokenEntity.getEmail())
                    .orElseThrow(() -> new IllegalArgumentException("User not found."));

            user.setPassword(passwordEncoder.encode(request.getNewPassword()));
            userRepo.save(user);

            // Delete the token after successful password reset
            tokenRepo.delete(tokenEntity);

            return "Password has been reset successfully.";
        } catch (IllegalArgumentException e) {
            return e.getMessage();
        } catch (Exception e) {
            return "An error occurred while resetting the password."+e.toString();
        }
    }
}
