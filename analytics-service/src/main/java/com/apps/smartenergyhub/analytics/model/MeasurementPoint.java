package com.apps.smartenergyhub.analytics.model;

import java.time.Instant;
import java.util.Objects;

/**
 * Mesure minimale utilisée par le module Analytics.
 *
 * <p>Seuls l'horodatage et la puissance sont nécessaires aux calculs descriptifs
 * (Niveau A) et à la détection d'anomalies (Niveau B). Ce record est volontairement
 * indépendant de Cassandra : la couche de lecture (à brancher plus tard) convertira
 * les lignes Cassandra en {@code MeasurementPoint}.</p>
 *
 * @param timestamp horodatage UTC de la mesure (obligatoire)
 * @param powerKw   puissance consommée en kW, positive ou nulle (comme dans le contrat docs/api.md)
 */
public record MeasurementPoint(Instant timestamp, double powerKw) {

    public MeasurementPoint {
        Objects.requireNonNull(timestamp, "timestamp ne doit pas être null");
        if (!Double.isFinite(powerKw) || powerKw < 0) {
            throw new IllegalArgumentException("powerKw doit être un nombre positif ou nul : " + powerKw);
        }
    }
}
