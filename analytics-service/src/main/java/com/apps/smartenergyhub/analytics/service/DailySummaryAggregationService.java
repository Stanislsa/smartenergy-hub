package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.calculator.AnomalyDetector;
import com.apps.smartenergyhub.analytics.calculator.EnergyCalculator;
import com.apps.smartenergyhub.analytics.calculator.EnergyStatistics;
import com.apps.smartenergyhub.analytics.dto.DailySummaryResponse;
import com.apps.smartenergyhub.analytics.entity.DailySummary;
import com.apps.smartenergyhub.analytics.exception.ResourceNotFoundException;
import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import com.apps.smartenergyhub.analytics.reader.MeasurementReader;
import com.apps.smartenergyhub.analytics.repository.DailySummaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.apps.smartenergyhub.analytics.calculator.Anomaly;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Calcule le résumé d'une journée UTC à partir des mesures et l'enregistre dans MongoDB
 * (collection daily_summaries). Rejouable : un recalcul met à jour le document existant.
 */
@Service
@RequiredArgsConstructor
public class DailySummaryAggregationService {

    private final SensorService sensorService;
    private final DailySummaryRepository repository;
    private final MeasurementReader measurementReader;
    private final EnergyCalculator energyCalculator;
    private final AnomalyDetector anomalyDetector;

    public DailySummaryResponse compute(String sensorId, LocalDate date) {
        Double maxPowerKw = sensorService.get(sensorId).maxPowerKw();   // 404 si capteur inconnu
        Double threshold = (maxPowerKw != null && maxPowerKw > 0) ? maxPowerKw : null;

        Instant from = date.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = from.plus(Duration.ofDays(1));
        List<MeasurementPoint> points = measurementReader.findBySensorBetween(sensorId, from, to);
        if (points.isEmpty()) {
            throw new ResourceNotFoundException("Aucune mesure pour " + sensorId + " le " + date);
        }

        EnergyStatistics stats = energyCalculator.compute(points, threshold);
        int anomalyCount = (int) anomalyDetector
                .detectAll(points, threshold, AnomalyDetector.DEFAULT_Z_THRESHOLD)
                .stream()
                .map(Anomaly::timestamp)
                .distinct()
                .count();

        DailySummary summary = repository.findBySensorIdAndDate(sensorId, date.toString())
                .orElseGet(() -> DailySummary.builder()
                        .sensorId(sensorId).date(date.toString()).build());
        summary.setAvgPowerKw(round2(stats.avgPowerKw()));
        summary.setMaxPowerKw(round2(stats.maxPowerKw()));
        summary.setEnergyKwh(round2(stats.energyKwh()));
        summary.setAnomalyCount(anomalyCount);

        return DailySummaryResponse.from(repository.save(summary));
    }

    private static Double round2(Double value) {
        return value == null ? null : Math.round(value * 100.0) / 100.0;
    }
}