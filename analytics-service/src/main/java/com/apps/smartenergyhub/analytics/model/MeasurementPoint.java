package com.apps.smartenergyhub.analytics.model;

import java.time.Instant;
import java.util.Objects;

/**
 * Mesure utilisée par le module Analytics.
 *
 * <p>Ce record contient les données nécessaires aux calculs descriptifs
 * (Niveau A) et à la détection d'anomalies (Niveau B). Ce record est volontairement
 * indépendant de Cassandra : la couche de lecture (à brancher plus tard) convertira
 * les lignes Cassandra en {@code MeasurementPoint}.</p>
 *
 * @param timestamp horodatage UTC de la mesure (obligatoire)
 * @param powerKw   puissance consommée en kW, positive ou nulle (comme dans le contrat docs/api.md)
 * @param voltage   tension en V (optionnel)
 * @param temperature température en °C (optionnel)
 */
public record MeasurementPoint(Instant timestamp, double powerKw, Double voltage, Double temperature) {

    public MeasurementPoint {
        Objects.requireNonNull(timestamp, "timestamp ne doit pas être null");
        if (!Double.isFinite(powerKw) || powerKw < 0) {
            throw new IllegalArgumentException("powerKw doit être un nombre positif ou nul : " + powerKw);
        }
        if (voltage != null && (!Double.isFinite(voltage) || voltage < 0)) {
            throw new IllegalArgumentException("voltage doit être un nombre positif ou nul : " + voltage);
        }
        if (temperature != null && !Double.isFinite(temperature)) {
            throw new IllegalArgumentException("temperature doit être un nombre fini : " + temperature);
        }
    }

    /**
     * Constructeur simplifié pour compatibilité avec le code existant.
     */
    public MeasurementPoint(Instant timestamp, double powerKw) {
        this(timestamp, powerKw, null, null);
    }
}
