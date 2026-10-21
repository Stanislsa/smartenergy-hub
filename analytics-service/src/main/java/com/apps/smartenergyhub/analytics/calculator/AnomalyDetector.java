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
 *   <li>Avec n mesures, |z| ne peut pas dépasser (n − 1) / √n. Avec le seuil 3, il faut
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

    /**
     * Détecte les variations brusques de puissance entre mesures consécutives.
     * Une variation est considérée anormale si le pourcentage de variation dépasse le seuil.
     *
     * @param measurements mesures d'un capteur ({@code null} = aucune)
     * @param variationThreshold seuil de variation en % (ex: 50 pour 50%)
     * @return anomalies triées par horodatage croissant
     */
    public List<Anomaly> detectPowerVariations(List<MeasurementPoint> measurements, double variationThreshold) {
        if (!Double.isFinite(variationThreshold) || variationThreshold <= 0) {
            throw new IllegalArgumentException("variationThreshold doit être strictement positif : " + variationThreshold);
        }
        if (measurements == null || measurements.size() < 2) {
            return List.of();
        }

        List<MeasurementPoint> sorted = measurements.stream()
                .sorted(Comparator.comparing(MeasurementPoint::timestamp))
                .toList();

        List<Anomaly> anomalies = new ArrayList<>();
        for (int i = 1; i < sorted.size(); i++) {
            MeasurementPoint prev = sorted.get(i - 1);
            MeasurementPoint curr = sorted.get(i);

            if (prev.powerKw() == 0) {
                continue; // Éviter division par zéro
            }

            double variation = ((curr.powerKw() - prev.powerKw()) / prev.powerKw()) * 100;
            if (Math.abs(variation) > variationThreshold) {
                anomalies.add(new Anomaly(
                    curr.timestamp(),
                    curr.powerKw(),
                    AnomalyType.POWER_VARIATION,
                    variation,
                    variationThreshold,
                    null
                ));
            }
        }
        anomalies.sort(Comparator.comparing(Anomaly::timestamp));
        return List.copyOf(anomalies);
    }

    /**
     * Détecte les tensions hors plage acceptable.
     *
     * @param measurements mesures d'un capteur ({@code null} = aucune)
     * @param minVoltage tension minimale acceptable en V (ex: 210)
     * @param maxVoltage tension maximale acceptable en V (ex: 250)
     * @return anomalies triées par horodatage croissant
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
                .map(m -> new Anomaly(
                    m.timestamp(),
                    m.powerKw(),
                    AnomalyType.VOLTAGE,
                    m.voltage(),
                    maxVoltage,
                    m.voltage()
                ))
                .toList();
    }

    /**
     * Détecte les températures excessives.
     *
     * @param measurements mesures d'un capteur ({@code null} = aucune)
     * @param maxTemperature température maximale acceptable en °C (ex: 80)
     * @return anomalies triées par horodatage croissant
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
                .map(m -> new Anomaly(
                    m.timestamp(),
                    m.powerKw(),
                    AnomalyType.TEMPERATURE,
                    m.temperature(),
                    maxTemperature,
                    m.temperature()
                ))
                .toList();
    }

    /**
     * Applique toutes les méthodes de détection et renvoie toutes les anomalies triées.
     *
     * @param measurements mesures d'un capteur
     * @param maxPowerKw seuil de puissance max (optionnel)
     * @param zThreshold seuil z-score
     * @param variationThreshold seuil de variation de puissance en %
     * @param minVoltage tension minimale acceptable
     * @param maxVoltage tension maximale acceptable
     * @param maxTemperature température maximale acceptable
     * @return toutes les anomalies triées par horodatage
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
