package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.calculator.AnomalyDetector;
import com.apps.smartenergyhub.analytics.calculator.AnomalyType;
import com.apps.smartenergyhub.analytics.calculator.EnergyCalculator;
import com.apps.smartenergyhub.analytics.dto.AnalyticsSummaryResponse;
import com.apps.smartenergyhub.analytics.dto.AnomalyReportResponse;
import com.apps.smartenergyhub.analytics.dto.SensorResponse;
import com.apps.smartenergyhub.analytics.exception.InvalidAnalyticsRequestException;
import com.apps.smartenergyhub.analytics.exception.ResourceNotFoundException;
import com.apps.smartenergyhub.analytics.reader.DemoMeasurementReader;
import com.apps.smartenergyhub.analytics.reader.MeasurementReader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    private static final Instant FROM = Instant.parse("2026-09-30T00:00:00Z");
    private static final Instant TO = Instant.parse("2026-10-01T00:00:00Z");

    @Mock
    private SensorService sensorService;

    private final MeasurementReader reader = new DemoMeasurementReader();
    private AnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new AnalyticsService(sensorService, reader, new EnergyCalculator(), new AnomalyDetector());
    }

    private static SensorResponse sensor(Double maxPowerKw) {
        return new SensorResponse("SENSOR-001", "Compteur salle serveur", "Bâtiment A", 1,
                maxPowerKw, true, List.of(), FROM, FROM);
    }

    @Test
    @DisplayName("summary : 288 mesures sur 24 h, énergie ≈ 85 kWh, 1 dépassement de 8 kW (le pic)")
    void summaryOnOneDay() {
        when(sensorService.get("SENSOR-001")).thenReturn(sensor(8.0));

        AnalyticsSummaryResponse r = service.summary("SENSOR-001", FROM, TO);

        assertThat(r.sensorId()).isEqualTo("SENSOR-001");
        assertThat(r.from()).isEqualTo(FROM);
        assertThat(r.to()).isEqualTo(TO);
        assertThat(r.measurementCount()).isEqualTo(288);
        assertThat(r.avgPowerKw()).isCloseTo(3.5, within(0.1));
        assertThat(r.maxPowerKw()).isGreaterThan(12.0);
        assertThat(r.energyKwh()).isCloseTo(85.0, within(2.0));
        assertThat(r.maxPowerThresholdKw()).isEqualTo(8.0);
        assertThat(r.thresholdExceedances()).isEqualTo(1);
    }

    @Test
    @DisplayName("anomalies : le pic de 14h00 est détecté par les deux méthodes")
    void anomaliesOnOneDay() {
        when(sensorService.get("SENSOR-001")).thenReturn(sensor(8.0));

        AnomalyReportResponse r = service.anomalies("SENSOR-001", FROM, TO, 3.0);

        assertThat(r.measurementCount()).isEqualTo(288);
        assertThat(r.thresholdAnomalyCount()).isEqualTo(1);
        assertThat(r.zScoreAnomalyCount()).isEqualTo(1);
        assertThat(r.anomalies()).hasSize(2)
                .allMatch(a -> a.timestamp().equals(Instant.parse("2026-09-30T14:00:00Z")));
        assertThat(r.anomalies()).extracting(a -> a.method())
                .containsExactly(AnomalyType.THRESHOLD, AnomalyType.Z_SCORE);
    }

    @Test
    @DisplayName("Capteur sans maxPowerKw : pas d'anomalie de seuil, le z-score fonctionne")
    void sensorWithoutThreshold() {
        when(sensorService.get("SENSOR-001")).thenReturn(sensor(null));

        AnomalyReportResponse r = service.anomalies("SENSOR-001", FROM, TO, 3.0);

        assertThat(r.maxPowerThresholdKw()).isNull();
        assertThat(r.thresholdAnomalyCount()).isZero();
        assertThat(r.zScoreAnomalyCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("Capteur inconnu : ResourceNotFoundException (→ 404)")
    void unknownSensor() {
        when(sensorService.get("SENSOR-999")).thenThrow(new ResourceNotFoundException("Capteur introuvable : SENSOR-999"));

        assertThatThrownBy(() -> service.summary("SENSOR-999", FROM, TO))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("from ≥ to : InvalidAnalyticsRequestException (→ 400), MongoDB n'est pas interrogé")
    void invalidPeriod() {
        assertThatThrownBy(() -> service.summary("SENSOR-001", TO, FROM))
                .isInstanceOf(InvalidAnalyticsRequestException.class);
        verify(sensorService, never()).get(any());
    }

    @Test
    @DisplayName("Seuil z ≤ 0 : InvalidAnalyticsRequestException (→ 400)")
    void invalidZThreshold() {
        assertThatThrownBy(() -> service.anomalies("SENSOR-001", FROM, TO, 0))
                .isInstanceOf(InvalidAnalyticsRequestException.class);
    }

    @Test
    @DisplayName("Période par défaut : les 24 h précédant 'to'")
    void defaultPeriod() {
        AnalyticsService.AnalysisPeriod p = AnalyticsService.resolvePeriod(null, TO, Instant.now());

        assertThat(p.from()).isEqualTo(FROM);
        assertThat(p.to()).isEqualTo(TO);
    }

    @Test
    @DisplayName("Période de plus de 31 jours refusée")
    void periodTooLong() {
        assertThatThrownBy(() -> AnalyticsService.resolvePeriod(FROM, FROM.plus(Duration.ofDays(32)), Instant.now()))
                .isInstanceOf(InvalidAnalyticsRequestException.class);
    }
}
