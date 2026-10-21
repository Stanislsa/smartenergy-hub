package com.apps.smartenergyhub.analytics.reader;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DemoMeasurementReaderTest {

    private static final Instant MIDNIGHT = Instant.parse("2026-09-30T00:00:00Z");
    private static final Instant NEXT_MIDNIGHT = Instant.parse("2026-10-01T00:00:00Z");

    private final DemoMeasurementReader reader = new DemoMeasurementReader();

    @Test
    @DisplayName("24 h à raison d'une mesure toutes les 5 min = 288 mesures dans [from ; to[")
    void oneDayGives288Points() {
        List<MeasurementPoint> points = reader.findBySensorBetween("SENSOR-001", MIDNIGHT, NEXT_MIDNIGHT);

        assertThat(points).hasSize(288);
        assertThat(points.get(0).timestamp()).isEqualTo(MIDNIGHT);
        assertThat(points).allMatch(p -> !p.timestamp().isBefore(MIDNIGHT) && p.timestamp().isBefore(NEXT_MIDNIGHT));
    }

    @Test
    @DisplayName("Un début non aligné commence à la mesure suivante (08:02 → 08:05)")
    void unalignedStart() {
        List<MeasurementPoint> points = reader.findBySensorBetween("SENSOR-001",
                Instant.parse("2026-09-30T08:02:00Z"), Instant.parse("2026-09-30T08:20:00Z"));

        assertThat(points).extracting(MeasurementPoint::timestamp).containsExactly(
                Instant.parse("2026-09-30T08:05:00Z"),
                Instant.parse("2026-09-30T08:10:00Z"),
                Instant.parse("2026-09-30T08:15:00Z"));
    }

    @Test
    @DisplayName("Pic ×3 à 14h00, consommation normale entre 1,5 et 5,5 kW le reste du temps")
    void spikeAtTwoPm() {
        Instant spike = Instant.parse("2026-09-30T14:00:00Z");
        List<MeasurementPoint> points = reader.findBySensorBetween("SENSOR-001", MIDNIGHT, NEXT_MIDNIGHT);

        MeasurementPoint spikePoint = points.stream().filter(p -> p.timestamp().equals(spike)).findFirst().orElseThrow();
        assertThat(spikePoint.powerKw()).isGreaterThan(12.0);
        assertThat(points).filteredOn(p -> !p.timestamp().equals(spike))
                .allMatch(p -> p.powerKw() >= 1.5 && p.powerKw() <= 5.5);
    }

    @Test
    @DisplayName("Données reproductibles : deux appels identiques donnent le même résultat")
    void deterministic() {
        assertThat(reader.findBySensorBetween("SENSOR-001", MIDNIGHT, NEXT_MIDNIGHT))
                .isEqualTo(reader.findBySensorBetween("SENSOR-001", MIDNIGHT, NEXT_MIDNIGHT));
    }
}
