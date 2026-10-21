package com.apps.smartenergyhub.analytics.calculator;

import java.time.Instant;

/**
 * Mesure considérée comme anormale.
 *
 * @param timestamp horodatage de la mesure
 * @param powerKw   puissance mesurée en kW
 * @param type      méthode de détection
 * @param score     pour THRESHOLD : rapport P / Pmax ; pour Z_SCORE : valeur de zt ; pour POWER_VARIATION : % de variation ; pour VOLTAGE : tension mesurée ; pour TEMPERATURE : température mesurée
 * @param limit     pour THRESHOLD : Pmax en kW ; pour Z_SCORE : seuil appliqué sur |zt| ; pour POWER_VARIATION : seuil de variation % ; pour VOLTAGE : plage acceptable ; pour TEMPERATURE : seuil de température
 * @param value     valeur mesurée (voltage ou temperature selon le type)
 */
public record Anomaly(
        Instant timestamp,
        double powerKw,
        AnomalyType type,
        double score,
        double limit,
        Double value
) {

    public Anomaly(Instant timestamp, double powerKw, AnomalyType type, double score, double limit) {
        this(timestamp, powerKw, type, score, limit, null);
    }
}
