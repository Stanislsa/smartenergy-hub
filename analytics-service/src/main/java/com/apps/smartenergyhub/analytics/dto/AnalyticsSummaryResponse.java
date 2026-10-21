package com.apps.smartenergyhub.analytics.dto;

import com.apps.smartenergyhub.analytics.calculator.EnergyStatistics;

import java.time.Instant;

/**
 * Réponse de {@code GET /api/analytics/{sensorId}/summary} (Étape 9 – Niveau A).
 * Les valeurs sont arrondies à 3 décimales. Moyenne/min/max valent {@code null}
 * s'il n'y a aucune mesure sur la période.
 */
public record AnalyticsSummaryResponse(
        String sensorId,
        Instant from,
        Instant to,
        long measurementCount,
        Double avgPowerKw,
        Double minPowerKw,
        Double maxPowerKw,
        double energyKwh,
        Double maxPowerThresholdKw,
        long thresholdExceedances
) {
    public static AnalyticsSummaryResponse of(String sensorId, Instant from, Instant to, EnergyStatistics s) {
        return new AnalyticsSummaryResponse(
                sensorId, from, to,
                s.measurementCount(),
                round(s.avgPowerKw()),
                round(s.minPowerKw()),
                round(s.maxPowerKw()),
                round(s.energyKwh()),
                s.thresholdKw(),
                s.thresholdExceedances());
    }

    static Double round(Double value) {
        return value == null ? null : Math.round(value * 1000) / 1000.0;
    }
}
