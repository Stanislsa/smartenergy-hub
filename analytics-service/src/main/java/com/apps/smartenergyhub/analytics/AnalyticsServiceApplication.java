package com.apps.smartenergyhub.analytics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Application principale du service d'analyse.
 * Ce service fournit une API de lecture pour l'analyse des données énergétiques.
 */
@SpringBootApplication
public class AnalyticsServiceApplication {

    /**
     * Point d'entrée principal de l'application.
     * @param args Arguments de ligne de commande
     */
    public static void main(String[] args) {
        SpringApplication.run(AnalyticsServiceApplication.class, args);
    }

}
