package com.apps.smartenergyhub.analytics.dto;

import jakarta.validation.constraints.NotBlank;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "username est obligatoire") String username,
            @NotBlank(message = "password est obligatoire") String password) {
    }

    public record LoginResponse(
            String accessToken, String tokenType, long expiresIn, String username, String role) {
    }

    public record CurrentUserResponse(String username, String role) {
    }
}