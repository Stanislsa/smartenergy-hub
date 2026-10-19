package com.apps.smartenergyhub.collector.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Contrôleur principal pour le service de collecte.
 * Fournit des endpoints de base pour vérifier le statut du service.
 */
@RestController
public class HomeController {

    /**
     * Endpoint racine pour vérifier que le service fonctionne.
     * @return Message de confirmation
     */
    @GetMapping("/")
    public String home() {
        return "Collector Service is running!";
    }

    /**
     * Endpoint de vérification de santé.
     * @return Statut OK
     */
    @GetMapping("/health")
    public String health() {
        return "OK";
    }
}
