package com.apps.smartenergyhub.analytics.dto;

import com.apps.smartenergyhub.analytics.calculator.Anomaly;
import com.apps.smartenergyhub.analytics.calculator.AnomalyType;

import java.time.Instant;

/**
 * Une anomalie détectée.
 *
 * @param method THRESHOLD, Z_SCORE, POWER_VARIATION, VOLTAGE ou TEMPERATURE
 * @param score  THRESHOLD : P / Pmax ; Z_SCORE : z ; POWER_VARIATION : variation en % ;
 *               VOLTAGE : tension (V) ; TEMPERATURE : température (°C)
 * @param limit  THRESHOLD : Pmax (kW) ; Z_SCORE : seuil sur |z| ; POWER_VARIATION : seuil en % ;
 *               VOLTAGE : borne dépassée (V) ; TEMPERATURE : température maximale (°C)
 * @param value  valeur mesurée pour VOLTAGE (V) et TEMPERATURE (°C), {@code null} sinon
 */
public record AnomalyResponse(
        Instant timestamp,
        double powerKw,
        AnomalyType method,
        double score,
        double limit,
        Double value
) {
    public AnomalyResponse(Instant timestamp, double powerKw, AnomalyType method, double score, double limit) {
        this(timestamp, powerKw, method, score, limit, null);
    }

    public static AnomalyResponse from(Anomaly a) {
        return new AnomalyResponse(
                a.timestamp(),
                a.powerKw(),
                a.type(),
                AnalyticsSummaryResponse.round(a.score()),
                a.limit(),
                a.value());
    }
}
