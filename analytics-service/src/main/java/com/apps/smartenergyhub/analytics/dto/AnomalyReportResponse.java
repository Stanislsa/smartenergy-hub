package com.apps.smartenergyhub.analytics.dto;

import java.time.Instant;
import java.util.List;

/**
 * Réponse de {@code GET /api/analytics/{sensorId}/anomalies} (Étape 9 – Niveau B).
 *
 * @param maxPowerThresholdKw   maxPowerKw du capteur (MongoDB), {@code null} si non configuré
 * @param zThreshold            seuil appliqué sur |z|
 * @param thresholdAnomalyCount nombre d'anomalies détectées par la méthode du seuil
 * @param zScoreAnomalyCount    nombre d'anomalies détectées par la méthode z-score
 * @param anomalies             détail, trié par horodatage
 */
public record AnomalyReportResponse(
        String sensorId,
        Instant from,
        Instant to,
        long measurementCount,
        Double maxPowerThresholdKw,
        double zThreshold,
        long thresholdAnomalyCount,
        long zScoreAnomalyCount,
        List<AnomalyResponse> anomalies
) {
}
