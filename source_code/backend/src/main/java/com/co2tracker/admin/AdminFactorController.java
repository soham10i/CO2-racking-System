package com.co2tracker.admin;

import com.co2tracker.admin.AdminFactorDtos.AdminFactor;
import com.co2tracker.admin.AdminFactorDtos.Preview;
import com.co2tracker.admin.AdminFactorDtos.VersionRequest;
import com.co2tracker.auth.AuthPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Admin only: SecurityConfig restricts /api/v1/admin/** to the ADMIN role. */
@RestController
@RequestMapping("/api/v1/admin/factors")
public class AdminFactorController {

    private final AdminFactorService service;

    public AdminFactorController(AdminFactorService service) {
        this.service = service;
    }

    @GetMapping
    public List<AdminFactor> list() {
        return service.list();
    }

    @PostMapping("/{id}/preview")
    public Preview preview(@PathVariable UUID id, @Valid @RequestBody VersionRequest req) {
        return service.preview(id, req);
    }

    @PostMapping("/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminFactor publish(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id,
            @Valid @RequestBody VersionRequest req) {
        return service.publish(p.userId(), id, req);
    }
}
