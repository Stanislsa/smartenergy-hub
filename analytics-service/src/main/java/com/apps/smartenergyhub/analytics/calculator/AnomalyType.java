package com.apps.smartenergyhub.analytics.calculator;

/**
 * Méthode ayant signalé une anomalie (Étape 9 – Niveau B).
 */
public enum AnomalyType {

    /** Anomalie = Pt &gt; Pmax, avec Pmax le maxPowerKw du capteur (MongoDB). */
    THRESHOLD,

    /** Anomalie = |zt| &gt; seuil, avec zt = (Pt − µ) / σ. */
    Z_SCORE,

    /** Anomalie = variation brusque de puissance entre deux mesures consécutives. */
    POWER_VARIATION,

    /** Anomalie = tension hors plage acceptable. */
    VOLTAGE,

    /** Anomalie = température excessive. */
    TEMPERATURE
}
