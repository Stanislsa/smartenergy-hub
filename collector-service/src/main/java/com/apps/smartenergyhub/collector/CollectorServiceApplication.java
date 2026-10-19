package com.apps.smartenergyhub.collector;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Application principale du service de collecte.
 * Ce service est responsable de la collecte des données énergétiques
 * provenant de diverses sources.
 */
@SpringBootApplication
public class CollectorServiceApplication {

    /**
     * Point d'entrée principal de l'application.
     * @param args Arguments de ligne de commande
     */
    public static void main(String[] args) {
        SpringApplication.run(CollectorServiceApplication.class, args);
    }

}
