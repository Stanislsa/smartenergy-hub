package com.apps.smartenergyhub.analytics.dto;

import com.apps.smartenergyhub.analytics.calculator.Anomaly;
import com.apps.smartenergyhub.analytics.calculator.AnomalyType;

import java.time.Instant;

/**
 * Une anomalie détectée.
 *
 * @param method THRESHOLD (P &gt; Pmax) ou Z_SCORE (|z| &gt; seuil)
 * @param score  THRESHOLD : P / Pmax ; Z_SCORE : valeur de z
 * @param limit  THRESHOLD : Pmax en kW ; Z_SCORE : seuil sur |z|
 */
public record AnomalyResponse(
        Instant timestamp,
        double powerKw,
        AnomalyType method,
        double score,
        double limit
) {
    public static AnomalyResponse from(Anomaly a) {
        return new AnomalyResponse(
                a.timestamp(),
                a.powerKw(),
                a.type(),
                AnalyticsSummaryResponse.round(a.score()),
                a.limit());
    }
}
