package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.dto.AuthDtos.LoginRequest;
import com.apps.smartenergyhub.analytics.dto.AuthDtos.LoginResponse;
import com.apps.smartenergyhub.analytics.entity.AppUser;
import com.apps.smartenergyhub.analytics.exception.InvalidCredentialsException;
import com.apps.smartenergyhub.analytics.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.security.enabled", havingValue = "true")
public class AuthService {

    private static final Duration TOKEN_LIFETIME = Duration.ofHours(1);

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public LoginResponse login(LoginRequest request) {
        // Même erreur pour « utilisateur inconnu » et « mauvais mot de passe »
        AppUser user = users.findByUsername(request.username())
                .filter(AppUser::isActive)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(InvalidCredentialsException::new);

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("smartenergy-hub")
                .subject(user.getUsername())
                .issuedAt(now)
                .expiresAt(now.plus(TOKEN_LIFETIME))
                .claim("role", user.getRole())
                .build();
        String token = jwtEncoder
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();

        return new LoginResponse(token, "Bearer", TOKEN_LIFETIME.toSeconds(), user.getUsername(), user.getRole());
    }
}