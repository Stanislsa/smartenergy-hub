package com.apps.smartenergyhub.storage;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Application principale du service de stockage.
 * Ce service est responsable du stockage des données énergétiques
 * dans MongoDB, Redis et Cassandra.
 */
@SpringBootApplication
public class StorageServiceApplication {

    /**
     * Point d'entrée principal de l'application.
     * @param args Arguments de ligne de commande
     */
    public static void main(String[] args) {
        SpringApplication.run(StorageServiceApplication.class, args);
    }

}
