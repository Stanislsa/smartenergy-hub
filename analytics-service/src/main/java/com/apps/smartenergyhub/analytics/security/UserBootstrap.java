package com.apps.smartenergyhub.analytics.security;

import com.apps.smartenergyhub.analytics.entity.AppUser;
import com.apps.smartenergyhub.analytics.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.security.enabled", havingValue = "true")
public class UserBootstrap implements ApplicationRunner {

    private final AppUserRepository users;
    private final PasswordEncoder encoder;

    @Value("${app.security.admin-username:}")
    private String adminUsername;
    @Value("${app.security.admin-password:}")
    private String adminPassword;
    @Value("${app.security.viewer-username:}")
    private String viewerUsername;
    @Value("${app.security.viewer-password:}")
    private String viewerPassword;

    @Override
    public void run(ApplicationArguments args) {
        create(adminUsername, adminPassword, "ADMIN");
        create(viewerUsername, viewerPassword, "VIEWER");
        if (users.count() == 0) {
            log.warn("Sécurité activée mais aucun utilisateur : définir APP_ADMIN_USERNAME / APP_ADMIN_PASSWORD");
        }
    }

    private void create(String username, String password, String role) {
        if (username.isBlank() || password.isBlank() || users.existsByUsername(username)) {
            return;
        }
        if (password.length() < 8) {
            throw new IllegalStateException("Le mot de passe de " + username + " doit avoir 8 caractères minimum");
        }
        users.save(AppUser.builder()
                .username(username)
                .passwordHash(encoder.encode(password))
                .role(role)
                .active(true)
                .createdAt(Instant.now())
                .build());
        log.info("Utilisateur {} ({}) créé", username, role);
    }
}