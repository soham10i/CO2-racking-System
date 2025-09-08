package com.twd.SpringSecurityJWT.dto;

import lombok.Data;

@Data
public class PasswordResetDTO {
    private String token;
    private String newPassword;
}
