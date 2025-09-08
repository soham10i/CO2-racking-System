package com.twd.SpringSecurityJWT.dto;

import lombok.Data;

@Data
public class UserProfileDTO {
    private String firstName;
    private String lastName;
    private String email;
    private String address;
    private String phoneNumber;
    private String role;
}
