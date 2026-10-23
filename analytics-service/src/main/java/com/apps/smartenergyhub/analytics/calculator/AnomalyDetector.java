package com.apps.smartenergyhub.analytics.calculator;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Détection simple d'anomalies (Étape 9 – Niveau B du sujet).
 *
 * <h2>1. Méthode par seuil</h2>
 * <p>Anomalie = Pt &gt; Pmax, où Pmax est le {@code maxPowerKw} du capteur stocké
 * dans MongoDB. Une mesure égale à Pmax n'est pas une anomalie.</p>
 *
 * <h2>2. Méthode statistique (score standardisé)</h2>
 * <p>zt = (Pt − µ) / σ, avec µ la moyenne et σ l'écart-type (population) des mesures
 * de la période. Une mesure est signalée lorsque |zt| &gt; seuil.</p>
 *
 * <p><b>Choix du seuil par défaut : 3.</b> Pour une distribution proche de la loi
 * normale, environ 99,7 % des valeurs ont |z| ≤ 3 : une valeur au-delà est donc rare
 * et mérite d'être signalée, sans générer trop de fausses alertes sur les variations
 * normales (cycle jour/nuit simulé par le sinus du simulateur).</p>
 *
 * <p><b>Limites de la méthode z-score</b> (à reprendre dans le rapport) :</p>
 * <ul>
 *   <li>Si σ = 0 (puissance constante), z n'est pas défini : aucune anomalie n'est signalée.</li>
 *   <li>Avec n mesures, |z| ne peut pas dépasser √(n − 1) (écart-type de population). Avec le seuil 3, il faut
 *       donc au moins 11 mesures pour qu'une anomalie soit détectable.</li>
 *   <li>Un pic très fort augmente lui-même µ et σ, ce qui « masque » partiellement les autres pics.</li>
 *   <li>La méthode suppose une consommation à peu près stable sur la période ; elle détecte mal
 *       une dérive lente.</li>
 * </ul>
 */
@Component
public class AnomalyDetector {

    /** Seuil par défaut sur |z|. */
    public static final double DEFAULT_Z_THRESHOLD = 3.0;

    /**
     * Méthode par seuil : Pt &gt; Pmax.
     *
     * @param measurements mesures d'un capteur ({@code null} = aucune)
     * @param maxPowerKw   Pmax du capteur ; si {@code null} (capteur sans seuil configuré),
     *                     aucune anomalie de seuil n'est signalée
     * @return anomalies triées par horodatage croissant
     */
    public List<Anomaly> detectByThreshold(List<MeasurementPoint> measurements, Double maxPowerKw) {
        if (measurements == null || measurements.isEmpty() || maxPowerKw == null) {
            return List.of();
        }
        if (!Double.isFinite(maxPowerKw) || maxPowerKw <= 0) {
            throw new IllegalArgumentException("maxPowerKw doit être strictement positif : " + maxPowerKw);
        }
        return measurements.stream()
                .filter(m -> m.powerKw() > maxPowerKw)
                .sorted(Comparator.comparing(MeasurementPoint::timestamp))
                .map(m -> new Anomaly(m.timestamp(), m.powerKw(), AnomalyType.THRESHOLD,
                        m.powerKw() / maxPowerKw, maxPowerKw))
                .toList();
    }

    /**
     * Méthode statistique avec le seuil par défaut ({@value #DEFAULT_Z_THRESHOLD}).
     */
    public List<Anomaly> detectByZScore(List<MeasurementPoint> measurements) {
        return detectByZScore(measurements, DEFAULT_Z_THRESHOLD);
    }

    /**
     * Méthode statistique : |zt| &gt; zThreshold.
     *
     * @param measurements mesures d'un capteur ({@code null} = aucune)
     * @param zThreshold   seuil strictement positif sur |z|
     * @return anomalies triées par horodatage croissant
     */
    public List<Anomaly> detectByZScore(List<MeasurementPoint> measurements, double zThreshold) {
        if (!Double.isFinite(zThreshold) || zThreshold <= 0) {
            throw new IllegalArgumentException("zThreshold doit être strictement positif : " + zThreshold);
        }
        if (measurements == null || measurements.size() < 2) {
            return List.of();
        }

        int n = measurements.size();
        double mean = measurements.stream().mapToDouble(MeasurementPoint::powerKw).sum() / n;
        double variance = measurements.stream()
                .mapToDouble(m -> (m.powerKw() - mean) * (m.powerKw() - mean))
                .sum() / n;
        double stdDev = Math.sqrt(variance);
        if (stdDev == 0.0) {
            return List.of();
        }

        List<Anomaly> anomalies = new ArrayList<>();
        for (MeasurementPoint m : measurements) {
            double z = (m.powerKw() - mean) / stdDev;
            if (Math.abs(z) > zThreshold) {
                anomalies.add(new Anomaly(m.timestamp(), m.powerKw(), AnomalyType.Z_SCORE, z, zThreshold));
            }
        }
        anomalies.sort(Comparator.comparing(Anomaly::timestamp));
        return List.copyOf(anomalies);
    }

    /**
     * Applique les deux méthodes et renvoie toutes les anomalies triées par horodatage.
     * Une même mesure peut apparaître deux fois si les deux méthodes la signalent
     * (une fois par type), ce qui permet de savoir quelle méthode l'a détectée.
     */
    public List<Anomaly> detectAll(List<MeasurementPoint> measurements, Double maxPowerKw, double zThreshold) {
        List<Anomaly> all = new ArrayList<>(detectByThreshold(measurements, maxPowerKw));
        all.addAll(detectByZScore(measurements, zThreshold));
        all.sort(Comparator.comparing(Anomaly::timestamp).thenComparing(Anomaly::type));
        return List.copyOf(all);
    }

    /** Écart absolu minimal (kW) pour qu'une variation de puissance soit signalée. */
    public static final double DEFAULT_MIN_VARIATION_KW = 1.0;

    /**
     * Variations brusques de puissance entre deux mesures consécutives.
     * Utilise l'écart minimal par défaut ({@value #DEFAULT_MIN_VARIATION_KW} kW).
     */
    public List<Anomaly> detectPowerVariations(List<MeasurementPoint> measurements, double variationThreshold) {
        return detectPowerVariations(measurements, variationThreshold, DEFAULT_MIN_VARIATION_KW);
    }

    /**
     * Variations brusques de puissance entre deux mesures consécutives.
     *
     * <p>Une variation est signalée si, à la fois :</p>
     * <ul>
     *   <li>|ΔP / P(t-1)| × 100 &gt; {@code variationThreshold} (%) ;</li>
     *   <li>|ΔP| ≥ {@code minDeltaKw} : évite les fausses alertes sur de très petites
     *       puissances (0,1 → 0,2 kW = +100 % mais négligeable) ;</li>
     *   <li>ce n'est pas le <b>retour à la normale</b> juste après une variation déjà signalée
     *       dans l'autre sens (sinon un seul pic produirait deux anomalies).</li>
     * </ul>
     *
     * @param measurements       mesures d'un capteur ({@code null} = aucune)
     * @param variationThreshold seuil de variation en % (ex. 50)
     * @param minDeltaKw         écart absolu minimal en kW (≥ 0)
     * @return anomalies triées par horodatage croissant ; score = variation en %
     */
    public List<Anomaly> detectPowerVariations(List<MeasurementPoint> measurements,
                                               double variationThreshold, double minDeltaKw) {
        if (!Double.isFinite(variationThreshold) || variationThreshold <= 0) {
            throw new IllegalArgumentException("variationThreshold doit être strictement positif : " + variationThreshold);
        }
        if (!Double.isFinite(minDeltaKw) || minDeltaKw < 0) {
            throw new IllegalArgumentException("minDeltaKw doit être positif ou nul : " + minDeltaKw);
        }
        if (measurements == null || measurements.size() < 2) {
            return List.of();
        }

        List<MeasurementPoint> sorted = measurements.stream()
                .sorted(Comparator.comparing(MeasurementPoint::timestamp))
                .toList();

        List<Anomaly> anomalies = new ArrayList<>();
        int lastFlagged = -2;
        double lastFlaggedSign = 0;
        for (int i = 1; i < sorted.size(); i++) {
            double previous = sorted.get(i - 1).powerKw();
            MeasurementPoint current = sorted.get(i);
            if (previous == 0) {
                continue; // variation relative non définie
            }
            double delta = current.powerKw() - previous;
            double variationPct = delta / previous * 100;
            if (Math.abs(variationPct) <= variationThreshold || Math.abs(delta) < minDeltaKw) {
                continue;
            }
            boolean returnToNormal = lastFlagged == i - 1 && Math.signum(delta) == -lastFlaggedSign;
            if (returnToNormal) {
                continue;
            }
            anomalies.add(new Anomaly(current.timestamp(), current.powerKw(),
                    AnomalyType.POWER_VARIATION, variationPct, variationThreshold, null));
            lastFlagged = i;
            lastFlaggedSign = Math.signum(delta);
        }
        return List.copyOf(anomalies);
    }

    /**
     * Tensions hors de la plage [minVoltage ; maxVoltage].
     * Les mesures sans tension sont ignorées.
     *
     * @return anomalies triées ; score = tension mesurée ; limit = la borne dépassée
     *         (minVoltage si trop basse, maxVoltage si trop haute) ; value = tension
     */
    public List<Anomaly> detectVoltageAnomalies(List<MeasurementPoint> measurements, double minVoltage, double maxVoltage) {
        if (!Double.isFinite(minVoltage) || minVoltage <= 0) {
            throw new IllegalArgumentException("minVoltage doit être strictement positif : " + minVoltage);
        }
        if (!Double.isFinite(maxVoltage) || maxVoltage <= minVoltage) {
            throw new IllegalArgumentException("maxVoltage doit être strictement supérieur à minVoltage");
        }
        if (measurements == null || measurements.isEmpty()) {
            return List.of();
        }

        return measurements.stream()
                .filter(m -> m.voltage() != null)
                .filter(m -> m.voltage() < minVoltage || m.voltage() > maxVoltage)
                .sorted(Comparator.comparing(MeasurementPoint::timestamp))
                .map(m -> new Anomaly(m.timestamp(), m.powerKw(), AnomalyType.VOLTAGE,
                        m.voltage(), m.voltage() < minVoltage ? minVoltage : maxVoltage, m.voltage()))
                .toList();
    }

    /**
     * Températures strictement supérieures à {@code maxTemperature}.
     * Les mesures sans température sont ignorées.
     *
     * @return anomalies triées ; score = value = température ; limit = maxTemperature
     */
    public List<Anomaly> detectTemperatureAnomalies(List<MeasurementPoint> measurements, double maxTemperature) {
        if (!Double.isFinite(maxTemperature)) {
            throw new IllegalArgumentException("maxTemperature doit être un nombre fini : " + maxTemperature);
        }
        if (measurements == null || measurements.isEmpty()) {
            return List.of();
        }

        return measurements.stream()
                .filter(m -> m.temperature() != null)
                .filter(m -> m.temperature() > maxTemperature)
                .sorted(Comparator.comparing(MeasurementPoint::timestamp))
                .map(m -> new Anomaly(m.timestamp(), m.powerKw(), AnomalyType.TEMPERATURE,
                        m.temperature(), maxTemperature, m.temperature()))
                .toList();
    }

    /**
     * Applique les cinq méthodes (seuil, z-score, variation, tension, température)
     * et renvoie toutes les anomalies triées par horodatage puis par type.
     */
    public List<Anomaly> detectAllAnomalies(
            List<MeasurementPoint> measurements,
            Double maxPowerKw,
            double zThreshold,
            double variationThreshold,
            double minVoltage,
            double maxVoltage,
            double maxTemperature) {

        List<Anomaly> all = new ArrayList<>();
        all.addAll(detectByThreshold(measurements, maxPowerKw));
        all.addAll(detectByZScore(measurements, zThreshold));
        all.addAll(detectPowerVariations(measurements, variationThreshold));
        all.addAll(detectVoltageAnomalies(measurements, minVoltage, maxVoltage));
        all.addAll(detectTemperatureAnomalies(measurements, maxTemperature));

        all.sort(Comparator.comparing(Anomaly::timestamp).thenComparing(Anomaly::type));
        return List.copyOf(all);
    }
}
