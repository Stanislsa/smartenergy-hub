package com.apps.smartenergyhub.analytics.controller;

import com.apps.smartenergyhub.analytics.dto.AuthDtos.CurrentUserResponse;
import com.apps.smartenergyhub.analytics.dto.AuthDtos.LoginRequest;
import com.apps.smartenergyhub.analytics.dto.AuthDtos.LoginResponse;
import com.apps.smartenergyhub.analytics.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.security.enabled", havingValue = "true")
@Tag(name = "Authentification", description = "Connexion et utilisateur courant (JWT)")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @Operation(summary = "Se connecter et obtenir un jeton JWT (valide 1 heure)")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    @Operation(summary = "Utilisateur courant (nom et rôle)")
    public CurrentUserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return new CurrentUserResponse(jwt.getSubject(), jwt.getClaimAsString("role"));
    }
}