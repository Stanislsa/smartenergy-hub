package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.calculator.AnomalyDetector;
import com.apps.smartenergyhub.analytics.calculator.EnergyCalculator;
import com.apps.smartenergyhub.analytics.dto.DailySummaryResponse;
import com.apps.smartenergyhub.analytics.dto.SensorResponse;
import com.apps.smartenergyhub.analytics.entity.DailySummary;
import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import com.apps.smartenergyhub.analytics.reader.MeasurementReader;
import com.apps.smartenergyhub.analytics.repository.DailySummaryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailySummaryAggregationServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 30);
    private static final Instant T0 = DAY.atStartOfDay(ZoneOffset.UTC).toInstant();

    @Mock SensorService sensorService;
    @Mock DailySummaryRepository repository;
    @Mock MeasurementReader reader;

    DailySummaryAggregationService service;

    @BeforeEach
    void setUp() {
        // Vraies classes de calcul (elles n'ont pas besoin de base de données)
        service = new DailySummaryAggregationService(
                sensorService, repository, reader, new EnergyCalculator(), new AnomalyDetector());
    }

    private void givenSensorAndPoints(List<MeasurementPoint> points) {
        when(sensorService.get("SENSOR-001")).thenReturn(
                new SensorResponse("SENSOR-001", "Compteur", "Bâtiment A", 1, 8.0, true, List.of(), null, null));
        when(reader.findBySensorBetween(eq("SENSOR-001"), any(), any())).thenReturn(points);
        when(repository.findBySensorIdAndDate("SENSOR-001", "2026-09-30")).thenReturn(Optional.empty());
        when(repository.save(any(DailySummary.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void compute_calculeEtEnregistreLeResume() {
        givenSensorAndPoints(List.of(
                new MeasurementPoint(T0, 2.0),
                new MeasurementPoint(T0.plusSeconds(3600), 4.0),
                new MeasurementPoint(T0.plusSeconds(7200), 12.0)));

        DailySummaryResponse r = service.compute("SENSOR-001", DAY);

        assertEquals(6.0, r.avgPowerKw());     // (2 + 4 + 12) / 3
        assertEquals(12.0, r.maxPowerKw());
        assertEquals(6.0, r.energyKwh());      // 2 kW x 1 h + 4 kW x 1 h
        assertEquals(1, r.anomalyCount());     // 12 kW > seuil de 8 kW
    }

    @Test
    void compute_compteUneSeuleAnomaliePourUnPicDetecteParDeuxMethodes() {
        // 24 mesures à 3 kW avec un pic à 12,5 kW : dépasse le seuil (8 kW) ET le z-score (> 3)
        List<MeasurementPoint> points = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            points.add(new MeasurementPoint(T0.plusSeconds(3600L * i), i == 18 ? 12.5 : 3.0));
        }
        givenSensorAndPoints(points);

        DailySummaryResponse r = service.compute("SENSOR-001", DAY);

        assertEquals(12.5, r.maxPowerKw());
        assertEquals(1, r.anomalyCount());     // un pic = une anomalie, pas deux
    }
}