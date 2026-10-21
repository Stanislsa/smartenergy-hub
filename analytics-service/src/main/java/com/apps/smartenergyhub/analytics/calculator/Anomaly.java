package com.apps.smartenergyhub.analytics.calculator;

import java.time.Instant;

/**
 * Mesure considérée comme anormale.
 *
 * @param timestamp horodatage de la mesure
 * @param powerKw   puissance mesurée en kW
 * @param type      méthode de détection
 * @param score     pour THRESHOLD : rapport P / Pmax ; pour Z_SCORE : valeur de zt
 * @param limit     pour THRESHOLD : Pmax en kW ; pour Z_SCORE : seuil appliqué sur |zt|
 */
public record Anomaly(
        Instant timestamp,
        double powerKw,
        AnomalyType type,
        double score,
        double limit
) {
}
