package com.apps.smartenergyhub.analytics.calculator;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class AnomalyDetectorTest {

    private static final Instant T0 = Instant.parse("2026-09-30T08:00:00Z");

    private final AnomalyDetector detector = new AnomalyDetector();

    private static MeasurementPoint at(int minutes, double powerKw) {
        return new MeasurementPoint(T0.plusSeconds(minutes * 60L), powerKw);
    }

    /**
     * 20 mesures autour de 3,5 kW puis un pic à ×3 (scénario d'anomalie du simulateur).
     */
    private static List<MeasurementPoint> normalSeriesWithSpike() {
        List<MeasurementPoint> points = new ArrayList<>();
        double[] noise = {0.10, -0.10, 0.05, -0.05, 0.08, -0.08, 0.02, -0.02, 0.12, -0.12};
        for (int i = 0; i < 20; i++) {
            points.add(at(i, 3.5 + noise[i % noise.length]));
        }
        points.add(at(20, 3.5 * 3));
        return points;
    }

    // ---------- Méthode par seuil ----------

    @Test
    @DisplayName("Seuil : P > Pmax est une anomalie, P = Pmax n'en est pas une")
    void thresholdStrictlyGreater() {
        List<MeasurementPoint> points = List.of(at(0, 7.0), at(1, 8.0), at(2, 8.5), at(3, 9.0));

        List<Anomaly> anomalies = detector.detectByThreshold(points, 8.0);

        assertThat(anomalies).extracting(Anomaly::powerKw).containsExactly(8.5, 9.0);
        assertThat(anomalies).allMatch(a -> a.type() == AnomalyType.THRESHOLD && a.limit() == 8.0);
        assertThat(anomalies.get(1).score()).isCloseTo(9.0 / 8.0, within(1e-9));
    }

    @Test
    @DisplayName("Seuil : capteur sans maxPowerKw configuré, aucune anomalie")
    void thresholdMissing() {
        assertThat(detector.detectByThreshold(List.of(at(0, 100.0)), null)).isEmpty();
    }

    @Test
    @DisplayName("Seuil : résultats triés par horodatage")
    void thresholdSorted() {
        List<MeasurementPoint> points = List.of(at(10, 9.0), at(0, 10.0), at(5, 11.0));

        assertThat(detector.detectByThreshold(points, 8.0))
                .extracting(Anomaly::timestamp)
                .isSorted();
    }

    @Test
    @DisplayName("Seuil : Pmax nul ou négatif refusé")
    void thresholdInvalid() {
        assertThatThrownBy(() -> detector.detectByThreshold(List.of(at(0, 1.0)), 0.0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---------- Méthode z-score ----------

    @Test
    @DisplayName("z-score : le pic ×3 est détecté et lui seul")
    void zScoreDetectsSpike() {
        List<Anomaly> anomalies = detector.detectByZScore(normalSeriesWithSpike());

        assertThat(anomalies).hasSize(1);
        Anomaly spike = anomalies.get(0);
        assertThat(spike.powerKw()).isEqualTo(10.5);
        assertThat(spike.type()).isEqualTo(AnomalyType.Z_SCORE);
        assertThat(spike.score()).isGreaterThan(AnomalyDetector.DEFAULT_Z_THRESHOLD);
        assertThat(spike.limit()).isEqualTo(AnomalyDetector.DEFAULT_Z_THRESHOLD);
    }

    @Test
    @DisplayName("z-score : une chute brutale (z négatif) est aussi détectée")
    void zScoreDetectsDrop() {
        List<MeasurementPoint> points = new ArrayList<>(normalSeriesWithSpike().subList(0, 20));
        points.add(at(20, 0.0));

        List<Anomaly> anomalies = detector.detectByZScore(points);

        assertThat(anomalies).hasSize(1);
        assertThat(anomalies.get(0).score()).isLessThan(-AnomalyDetector.DEFAULT_Z_THRESHOLD);
    }

    @Test
    @DisplayName("z-score : puissance constante (σ = 0), aucune anomalie")
    void zScoreConstantSeries() {
        List<MeasurementPoint> points = Collections.nCopies(30, at(0, 4.0));

        assertThat(detector.detectByZScore(points)).isEmpty();
    }

    @Test
    @DisplayName("z-score : moins de 2 mesures, aucune anomalie")
    void zScoreTooFewMeasurements() {
        assertThat(detector.detectByZScore(List.of())).isEmpty();
        assertThat(detector.detectByZScore(null)).isEmpty();
        assertThat(detector.detectByZScore(List.of(at(0, 99.0)))).isEmpty();
    }

    @Test
    @DisplayName("z-score : limite documentée, avec moins de 11 mesures |z| ne peut pas dépasser 3")
    void zScoreSmallSampleLimit() {
        // 9 mesures normales + 1 pic énorme = 10 mesures : |z| max = √9 = 3, jamais strictement > 3
        List<MeasurementPoint> points = new ArrayList<>(Collections.nCopies(9, at(0, 3.0)));
        points.add(at(1, 1000.0));

        assertThat(detector.detectByZScore(points)).isEmpty();
        assertThat(detector.detectByZScore(points, 2.5)).hasSize(1);
    }

    @Test
    @DisplayName("z-score : seuil nul ou négatif refusé")
    void zScoreInvalidThreshold() {
        assertThatThrownBy(() -> detector.detectByZScore(normalSeriesWithSpike(), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---------- Les deux méthodes ----------

    @Test
    @DisplayName("detectAll : le pic est signalé par les deux méthodes, triées par horodatage")
    void detectAllCombinesBothMethods() {
        List<Anomaly> anomalies = detector.detectAll(normalSeriesWithSpike(), 8.0,
                AnomalyDetector.DEFAULT_Z_THRESHOLD);

        assertThat(anomalies).extracting(Anomaly::type)
                .containsExactly(AnomalyType.THRESHOLD, AnomalyType.Z_SCORE);
        assertThat(anomalies).extracting(Anomaly::powerKw).containsOnly(10.5);
    }
}
