package com.apps.smartenergyhub.analytics.calculator;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Détection étendue : variations de puissance, tension, température.
 */
class ExtendedAnomalyDetectorTest {

    private static final Instant T0 = Instant.parse("2026-09-30T08:00:00Z");

    private final AnomalyDetector detector = new AnomalyDetector();

    private static MeasurementPoint power(int minutes, double powerKw) {
        return new MeasurementPoint(T0.plusSeconds(minutes * 60L), powerKw);
    }

    private static MeasurementPoint full(int minutes, double powerKw, Double voltage, Double temperature) {
        return new MeasurementPoint(T0.plusSeconds(minutes * 60L), powerKw, voltage, temperature);
    }

    // ---------- Variations de puissance ----------

    @Test
    @DisplayName("Variation : un pic ×3 est signalé une seule fois, le retour à la normale ne l'est pas")
    void spikeFlaggedOnceNotTheReturn() {
        List<MeasurementPoint> points = List.of(power(0, 4.0), power(5, 4.1), power(10, 12.3), power(15, 4.0), power(20, 4.1));

        List<Anomaly> anomalies = detector.detectPowerVariations(points, 50);

        assertThat(anomalies).hasSize(1);
        assertThat(anomalies.get(0).timestamp()).isEqualTo(T0.plusSeconds(600));
        assertThat(anomalies.get(0).type()).isEqualTo(AnomalyType.POWER_VARIATION);
        assertThat(anomalies.get(0).score()).isGreaterThan(50);
    }

    @Test
    @DisplayName("Variation : une chute brutale durable est signalée")
    void lastingDropFlagged() {
        List<MeasurementPoint> points = List.of(power(0, 6.0), power(5, 6.1), power(10, 1.0), power(15, 1.1));

        List<Anomaly> anomalies = detector.detectPowerVariations(points, 50);

        assertThat(anomalies).hasSize(1);
        assertThat(anomalies.get(0).score()).isLessThan(-50);
    }

    @Test
    @DisplayName("Variation : 0,1 → 0,2 kW (+100 %) ignorée car l'écart est inférieur à 1 kW")
    void smallAbsoluteChangeIgnored() {
        assertThat(detector.detectPowerVariations(List.of(power(0, 0.1), power(5, 0.2)), 50)).isEmpty();
        assertThat(detector.detectPowerVariations(List.of(power(0, 0.1), power(5, 0.2)), 50, 0.0)).hasSize(1);
    }

    @Test
    @DisplayName("Variation : ordre d'entrée indifférent, puissance précédente nulle ignorée")
    void unsortedAndZeroPrevious() {
        List<MeasurementPoint> points = List.of(power(10, 12.0), power(0, 0.0), power(5, 4.0));

        List<Anomaly> anomalies = detector.detectPowerVariations(points, 50);

        assertThat(anomalies).extracting(Anomaly::timestamp).containsExactly(T0.plusSeconds(600));
    }

    @Test
    @DisplayName("Variation : seuils invalides refusés")
    void variationInvalidThresholds() {
        assertThatThrownBy(() -> detector.detectPowerVariations(List.of(), 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> detector.detectPowerVariations(List.of(), 50, -1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---------- Tension ----------

    @Test
    @DisplayName("Tension : trop basse → limite = minimum, trop haute → limite = maximum, absente ignorée")
    void voltageOutOfRange() {
        List<MeasurementPoint> points = List.of(
                full(0, 3.0, 230.0, null),
                full(5, 3.0, 205.0, null),
                full(10, 3.0, 255.0, null),
                full(15, 3.0, null, null));

        List<Anomaly> anomalies = detector.detectVoltageAnomalies(points, 210, 250);

        assertThat(anomalies).hasSize(2);
        assertThat(anomalies.get(0).value()).isEqualTo(205.0);
        assertThat(anomalies.get(0).limit()).isEqualTo(210.0);
        assertThat(anomalies.get(1).value()).isEqualTo(255.0);
        assertThat(anomalies.get(1).limit()).isEqualTo(250.0);
        assertThat(anomalies).allMatch(a -> a.type() == AnomalyType.VOLTAGE);
    }

    @Test
    @DisplayName("Tension : bornes égales aux limites acceptées, plage invalide refusée")
    void voltageBoundsAndInvalidRange() {
        List<MeasurementPoint> points = List.of(full(0, 3.0, 210.0, null), full(5, 3.0, 250.0, null));

        assertThat(detector.detectVoltageAnomalies(points, 210, 250)).isEmpty();
        assertThatThrownBy(() -> detector.detectVoltageAnomalies(points, 250, 210))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---------- Température ----------

    @Test
    @DisplayName("Température : strictement au-dessus du maximum signalée, absente ignorée")
    void temperatureAboveMax() {
        List<MeasurementPoint> points = List.of(
                full(0, 3.0, null, 79.9),
                full(5, 3.0, null, 80.0),
                full(10, 3.0, null, 85.5),
                full(15, 3.0, null, null));

        List<Anomaly> anomalies = detector.detectTemperatureAnomalies(points, 80);

        assertThat(anomalies).hasSize(1);
        assertThat(anomalies.get(0).value()).isEqualTo(85.5);
        assertThat(anomalies.get(0).limit()).isEqualTo(80.0);
        assertThat(anomalies.get(0).type()).isEqualTo(AnomalyType.TEMPERATURE);
    }

    @Test
    @DisplayName("Température : maximum non fini refusé")
    void temperatureInvalidMax() {
        assertThatThrownBy(() -> detector.detectTemperatureAnomalies(List.of(), Double.NaN))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---------- Toutes les méthodes ----------

    @Test
    @DisplayName("Toutes les méthodes : un pic chaud et sous-tension est signalé par chaque méthode concernée")
    void allMethodsTogether() {
        List<MeasurementPoint> points = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            points.add(full(i * 5, 3.5 + (i % 2) * 0.1, 230.0, 30.0));
        }
        points.add(full(100, 10.5, 205.0, 90.0));

        List<Anomaly> anomalies = detector.detectAllAnomalies(points, 8.0, 3, 50, 210, 250, 80);

        assertThat(anomalies).extracting(Anomaly::type).containsExactly(
                AnomalyType.THRESHOLD, AnomalyType.Z_SCORE, AnomalyType.POWER_VARIATION,
                AnomalyType.VOLTAGE, AnomalyType.TEMPERATURE);
        assertThat(anomalies).allMatch(a -> a.timestamp().equals(T0.plusSeconds(6000)));
    }

    @Test
    @DisplayName("Mesures sans tension ni température (ancien format) : seules les méthodes de puissance s'appliquent")
    void powerOnlyMeasurements() {
        List<MeasurementPoint> points = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            points.add(power(i * 5, 3.5 + (i % 2) * 0.1));
        }
        points.add(power(100, 10.5));

        assertThat(detector.detectAllAnomalies(points, 8.0, 3, 50, 210, 250, 80))
                .extracting(Anomaly::type)
                .containsExactly(AnomalyType.THRESHOLD, AnomalyType.Z_SCORE, AnomalyType.POWER_VARIATION);
    }
}
