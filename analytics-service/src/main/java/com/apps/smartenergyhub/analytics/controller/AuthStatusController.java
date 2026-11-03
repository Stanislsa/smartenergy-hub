package com.apps.smartenergyhub.analytics.controller;

import com.apps.smartenergyhub.analytics.dto.AuthDtos.CurrentUserResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@ConditionalOnProperty(name = "app.security.enabled", havingValue = "false", matchIfMissing = true)
public class AuthStatusController {

    @GetMapping("/me")
    public CurrentUserResponse me() {
        return new CurrentUserResponse("anonymous", "VIEWER");
    }
}
