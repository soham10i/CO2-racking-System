package com.twd.SpringSecurityJWT.controller;

import com.twd.SpringSecurityJWT.dto.PasswordResetDTO;
import com.twd.SpringSecurityJWT.dto.PasswordResetRequestDTO;
import com.twd.SpringSecurityJWT.service.PasswordResetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class PasswordResetController {

    @Autowired
    private PasswordResetService passwordResetService;

    /**
     * Request password reset (send reset link).
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<String> requestPasswordReset(@RequestBody PasswordResetRequestDTO request) {
        String response = passwordResetService.requestPasswordReset(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Reset the password using the token.
     */
    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@RequestBody PasswordResetDTO request) {
        String response = passwordResetService.resetPassword(request);
        return ResponseEntity.ok(response);
    }
}
