package com.apps.smartenergyhub.analytics.calculator;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class EnergyCalculatorTest {

    private static final Instant T0 = Instant.parse("2026-09-30T08:00:00Z");
    private static final double EPS = 1e-9;

    private final EnergyCalculator calculator = new EnergyCalculator();

    private static MeasurementPoint at(int minutes, double powerKw) {
        return new MeasurementPoint(T0.plusSeconds(minutes * 60L), powerKw);
    }

    @Test
    @DisplayName("Aucune mesure : compteurs à 0, moyenne/min/max absents, énergie nulle")
    void emptyList() {
        EnergyStatistics stats = calculator.compute(List.of(), 5.0);

        assertThat(stats.measurementCount()).isZero();
        assertThat(stats.avgPowerKw()).isNull();
        assertThat(stats.minPowerKw()).isNull();
        assertThat(stats.maxPowerKw()).isNull();
        assertThat(stats.energyKwh()).isZero();
        assertThat(stats.thresholdExceedances()).isZero();
        assertThat(stats.thresholdKw()).isEqualTo(5.0);
    }

    @Test
    @DisplayName("Liste null traitée comme une liste vide")
    void nullList() {
        assertThat(calculator.compute(null).measurementCount()).isZero();
    }

    @Test
    @DisplayName("Une seule mesure : statistiques correctes, énergie nulle (durée inconnue)")
    void singleMeasurement() {
        EnergyStatistics stats = calculator.compute(List.of(at(0, 3.72)));

        assertThat(stats.measurementCount()).isEqualTo(1);
        assertThat(stats.avgPowerKw()).isEqualTo(3.72);
        assertThat(stats.minPowerKw()).isEqualTo(3.72);
        assertThat(stats.maxPowerKw()).isEqualTo(3.72);
        assertThat(stats.energyKwh()).isZero();
    }

    @Test
    @DisplayName("Moyenne, minimum, maximum et nombre de mesures")
    void descriptiveStatistics() {
        List<MeasurementPoint> points = List.of(at(0, 2.0), at(5, 4.0), at(10, 6.0), at(15, 8.0));

        EnergyStatistics stats = calculator.compute(points);

        assertThat(stats.measurementCount()).isEqualTo(4);
        assertThat(stats.avgPowerKw()).isCloseTo(5.0, within(EPS));
        assertThat(stats.minPowerKw()).isEqualTo(2.0);
        assertThat(stats.maxPowerKw()).isEqualTo(8.0);
    }

    @Test
    @DisplayName("Énergie : 3 kW constants pendant 1 h (mesure toutes les 5 min) = 3 kWh")
    void energyConstantPowerOneHour() {
        List<MeasurementPoint> points = new ArrayList<>();
        for (int minute = 0; minute <= 60; minute += 5) {
            points.add(at(minute, 3.0));
        }

        assertThat(calculator.compute(points).energyKwh()).isCloseTo(3.0, within(EPS));
    }

    @Test
    @DisplayName("Énergie : E = Σ Pi·Δt avec des intervalles irréguliers")
    void energyIrregularIntervals() {
        // 2 kW pendant 30 min (1 kWh) puis 4 kW pendant 15 min (1 kWh) ; la dernière mesure ne compte pas
        List<MeasurementPoint> points = List.of(at(0, 2.0), at(30, 4.0), at(45, 100.0));

        assertThat(calculator.compute(points).energyKwh()).isCloseTo(2.0, within(EPS));
    }

    @Test
    @DisplayName("L'ordre d'entrée n'a pas d'influence (Cassandra renvoie l'ordre décroissant)")
    void unsortedInputGivesSameResult() {
        List<MeasurementPoint> ascending = List.of(at(0, 2.0), at(30, 4.0), at(45, 1.0));
        List<MeasurementPoint> descending = List.of(at(45, 1.0), at(30, 4.0), at(0, 2.0));

        assertThat(calculator.compute(descending)).isEqualTo(calculator.compute(ascending));
    }

    @Test
    @DisplayName("Dépassements : seules les mesures strictement supérieures au seuil comptent")
    void thresholdExceedances() {
        List<MeasurementPoint> points = List.of(at(0, 7.9), at(5, 8.0), at(10, 8.1), at(15, 12.0));

        EnergyStatistics stats = calculator.compute(points, 8.0);

        assertThat(stats.thresholdExceedances()).isEqualTo(2);
    }

    @Test
    @DisplayName("Sans seuil, aucun dépassement n'est compté")
    void noThreshold() {
        EnergyStatistics stats = calculator.compute(List.of(at(0, 50.0)), null);

        assertThat(stats.thresholdKw()).isNull();
        assertThat(stats.thresholdExceedances()).isZero();
    }

    @Test
    @DisplayName("Seuil négatif refusé")
    void negativeThresholdRejected() {
        assertThatThrownBy(() -> calculator.compute(List.of(at(0, 1.0)), -1.0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
