package com.apps.smartenergyhub.analytics.dto;

import com.apps.smartenergyhub.analytics.calculator.AnomalyType;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Réponse de {@code GET /api/analytics/{sensorId}/anomalies} et {@code /anomalies/all}.
 *
 * @param maxPowerThresholdKw   maxPowerKw du capteur (MongoDB), {@code null} si non configuré
 * @param zThreshold            seuil appliqué sur |z|
 * @param thresholdAnomalyCount nombre d'anomalies détectées par la méthode du seuil
 * @param zScoreAnomalyCount    nombre d'anomalies détectées par la méthode z-score
 * @param anomalyCountByMethod  nombre d'anomalies pour chaque méthode utilisée (0 compris)
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
        Map<AnomalyType, Long> anomalyCountByMethod,
        List<AnomalyResponse> anomalies
) {

    /**
     * Construit la réponse en comptant les anomalies par méthode.
     *
     * @param methods méthodes appliquées : elles apparaissent toutes dans le décompte, même à 0
     */
    public static AnomalyReportResponse of(String sensorId, Instant from, Instant to, long measurementCount,
                                           Double maxPowerThresholdKw, double zThreshold,
                                           List<AnomalyType> methods, List<AnomalyResponse> anomalies) {
        Map<AnomalyType, Long> counts = new EnumMap<>(AnomalyType.class);
        methods.forEach(m -> counts.put(m, 0L));
        anomalies.forEach(a -> counts.merge(a.method(), 1L, Long::sum));
        return new AnomalyReportResponse(sensorId, from, to, measurementCount, maxPowerThresholdKw, zThreshold,
                counts.getOrDefault(AnomalyType.THRESHOLD, 0L),
                counts.getOrDefault(AnomalyType.Z_SCORE, 0L),
                counts, anomalies);
    }
}
