package com.apps.smartenergyhub.analytics.calculator;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Comparator;
import java.util.List;

/**
 * Analyse descriptive obligatoire (Étape 9 – Niveau A du sujet).
 *
 * <p>Calcule, pour une liste de mesures d'un capteur :</p>
 * <ul>
 *   <li>la moyenne, le minimum et le maximum de la puissance ;</li>
 *   <li>l'énergie consommée estimée ;</li>
 *   <li>le nombre de mesures reçues ;</li>
 *   <li>le nombre de dépassements d'un seuil.</li>
 * </ul>
 *
 * <h2>Estimation de l'énergie</h2>
 * <p>Le sujet donne E ≈ Σ Pi·Δt (kWh si Pi est en kW et Δt en heures).
 * Les mesures n'étant pas forcément régulières, Δt est l'intervalle réel entre une
 * mesure et la suivante : chaque puissance Pi est supposée constante jusqu'à la
 * mesure suivante (méthode des rectangles à gauche). La dernière mesure de la période
 * ne contribue pas, car on ne connaît pas sa durée.</p>
 *
 * <p>Les mesures sont triées par horodatage avant le calcul, car Cassandra
 * renvoie l'historique en ordre décroissant ({@code CLUSTERING ORDER BY ... DESC}).</p>
 *
 * <p>Cette classe ne dépend d'aucune base de données : elle reçoit des mesures déjà
 * lues et peut donc être testée unitairement.</p>
 */
@Component
public class EnergyCalculator {

    private static final double SECONDS_PER_HOUR = 3600.0;

    /**
     * Calcule les indicateurs descriptifs sans seuil de dépassement.
     */
    public EnergyStatistics compute(List<MeasurementPoint> measurements) {
        return compute(measurements, null);
    }

    /**
     * Calcule les indicateurs descriptifs.
     *
     * @param measurements mesures d'un même capteur sur la période (ordre quelconque, {@code null} = aucune)
     * @param thresholdKw  seuil en kW ; une mesure est un dépassement si P &gt; seuil.
     *                     {@code null} : aucun seuil, le compteur vaut 0.
     */
    public EnergyStatistics compute(List<MeasurementPoint> measurements, Double thresholdKw) {
        if (thresholdKw != null && (!Double.isFinite(thresholdKw) || thresholdKw < 0)) {
            throw new IllegalArgumentException("thresholdKw doit être positif ou nul : " + thresholdKw);
        }
        if (measurements == null || measurements.isEmpty()) {
            return new EnergyStatistics(0, null, null, null, 0.0, thresholdKw, 0);
        }

        List<MeasurementPoint> sorted = measurements.stream()
                .sorted(Comparator.comparing(MeasurementPoint::timestamp))
                .toList();

        double sum = 0.0;
        double min = Double.POSITIVE_INFINITY;
        double max = Double.NEGATIVE_INFINITY;
        long exceedances = 0;

        for (MeasurementPoint m : sorted) {
            double p = m.powerKw();
            sum += p;
            min = Math.min(min, p);
            max = Math.max(max, p);
            if (thresholdKw != null && p > thresholdKw) {
                exceedances++;
            }
        }

        return new EnergyStatistics(
                sorted.size(),
                sum / sorted.size(),
                min,
                max,
                estimateEnergyKwh(sorted),
                thresholdKw,
                exceedances
        );
    }

    /**
     * E ≈ Σ Pi·Δt avec Δt (en heures) = t(i+1) − t(i).
     *
     * @param sorted mesures triées par horodatage croissant
     */
    double estimateEnergyKwh(List<MeasurementPoint> sorted) {
        double energy = 0.0;
        for (int i = 0; i < sorted.size() - 1; i++) {
            MeasurementPoint current = sorted.get(i);
            MeasurementPoint next = sorted.get(i + 1);
            double deltaHours = Duration.between(current.timestamp(), next.timestamp()).toMillis()
                    / 1000.0 / SECONDS_PER_HOUR;
            energy += current.powerKw() * deltaHours;
        }
        return energy;
    }
}
