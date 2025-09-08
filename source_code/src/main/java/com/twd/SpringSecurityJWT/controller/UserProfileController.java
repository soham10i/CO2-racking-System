package com.twd.SpringSecurityJWT.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import com.twd.SpringSecurityJWT.dto.UserProfileDTO;
import com.twd.SpringSecurityJWT.entity.OurUsers;
import com.twd.SpringSecurityJWT.repository.UserRepository;

@RestController
@RequestMapping("/user")
public class UserProfileController {
    @Autowired
    private UserRepository ourUserRepo;

    /**
     * Fetch user profile details.
     */
    @GetMapping("/get-profile")
    public ResponseEntity<UserProfileDTO> getUserProfile() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String userEmail = authentication.getName();

        OurUsers user = ourUserRepo.findByEmail(userEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        UserProfileDTO userProfile = new UserProfileDTO();
        userProfile.setFirstName(user.getFirstName());
        userProfile.setLastName(user.getLastName());
        userProfile.setEmail(user.getEmail());
        userProfile.setAddress(user.getAddress());
        userProfile.setPhoneNumber(user.getPhoneNumber());
        userProfile.setRole(user.getRole());

        return ResponseEntity.ok(userProfile);
    }

    /**
     * Update user profile details.
     */
    @PostMapping("/update-profile")
    public ResponseEntity<String> updateUserProfile(@RequestBody UserProfileDTO userProfileDTO) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String userEmail = authentication.getName();

            OurUsers user = ourUserRepo.findByEmail(userEmail)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            user.setFirstName(userProfileDTO.getFirstName());
            user.setLastName(userProfileDTO.getLastName());
            user.setAddress(userProfileDTO.getAddress());
            user.setPhoneNumber(userProfileDTO.getPhoneNumber());
            user.setRole(userProfileDTO.getRole());

            ourUserRepo.save(user);
            return ResponseEntity.ok("User profile updated successfully");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("An error occurred while updating the profile: " + e.getMessage());
        }
    }
}
