package com.apps.smartenergyhub.analytics.calculator;

/**
 * Résultat de l'analyse descriptive (Étape 9 – Niveau A) sur une période.
 *
 * <p>Lorsque la période ne contient aucune mesure, {@code avgPowerKw},
 * {@code minPowerKw} et {@code maxPowerKw} valent {@code null} (il n'existe pas
 * de moyenne d'un ensemble vide), {@code energyKwh} vaut 0 et les compteurs valent 0.</p>
 *
 * @param measurementCount     nombre de mesures reçues sur la période
 * @param avgPowerKw           puissance moyenne en kW
 * @param minPowerKw           puissance minimale en kW
 * @param maxPowerKw           puissance maximale en kW
 * @param energyKwh            énergie estimée en kWh (E ≈ Σ Pi·Δt)
 * @param thresholdKw          seuil utilisé pour compter les dépassements ({@code null} si aucun)
 * @param thresholdExceedances nombre de mesures strictement supérieures au seuil
 */
public record EnergyStatistics(
        long measurementCount,
        Double avgPowerKw,
        Double minPowerKw,
        Double maxPowerKw,
        double energyKwh,
        Double thresholdKw,
        long thresholdExceedances
) {
}
