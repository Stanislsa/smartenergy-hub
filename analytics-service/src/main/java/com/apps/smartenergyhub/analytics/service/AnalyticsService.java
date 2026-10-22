package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.calculator.Anomaly;
import com.apps.smartenergyhub.analytics.calculator.AnomalyDetector;
import com.apps.smartenergyhub.analytics.calculator.AnomalyType;
import com.apps.smartenergyhub.analytics.calculator.EnergyCalculator;
import com.apps.smartenergyhub.analytics.dto.AnalyticsSummaryResponse;
import com.apps.smartenergyhub.analytics.dto.AnomalyReportResponse;
import com.apps.smartenergyhub.analytics.dto.AnomalyResponse;
import com.apps.smartenergyhub.analytics.exception.InvalidAnalyticsRequestException;
import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import com.apps.smartenergyhub.analytics.reader.MeasurementReader;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Orchestration du module Analytics (Étape 9, niveaux A et B).
 *
 * <ol>
 *   <li>Valide la période demandée ;</li>
 *   <li>Récupère le seuil {@code maxPowerKw} du capteur via {@link SensorService} (MongoDB,
 *       partie C) — renvoie 404 si le capteur n'existe pas ;</li>
 *   <li>Lit les mesures via {@link MeasurementReader} ;</li>
 *   <li>Délègue les calculs à {@link EnergyCalculator} et {@link AnomalyDetector}.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    /** Période par défaut quand {@code from} est absent : les 24 dernières heures. */
    public static final Duration DEFAULT_PERIOD = Duration.ofHours(24);

    /** Période maximale autorisée, pour éviter de lire un volume excessif de mesures. */
    public static final Duration MAX_PERIOD = Duration.ofDays(31);

    /** Méthodes de {@code /anomalies} (niveau B du sujet). */
    private static final List<AnomalyType> BASIC_METHODS = List.of(AnomalyType.THRESHOLD, AnomalyType.Z_SCORE);

    private final SensorService sensorService;
    private final MeasurementReader measurementReader;
    private final EnergyCalculator energyCalculator;
    private final AnomalyDetector anomalyDetector;

    /** Niveau A : indicateurs descriptifs. */
    public AnalyticsSummaryResponse summary(String sensorId, Instant from, Instant to) {
        AnalysisPeriod period = resolvePeriod(from, to, Instant.now());
        Double maxPowerKw = sensorThreshold(sensorId);
        List<MeasurementPoint> points = measurementReader.findBySensorBetween(sensorId, period.from(), period.to());

        return AnalyticsSummaryResponse.of(sensorId, period.from(), period.to(),
                energyCalculator.compute(points, maxPowerKw));
    }

    /** Niveau B : anomalies par seuil et par z-score. */
    public AnomalyReportResponse anomalies(String sensorId, Instant from, Instant to, double zThreshold) {
        if (!Double.isFinite(zThreshold) || zThreshold <= 0) {
            throw new InvalidAnalyticsRequestException("Le seuil z doit être strictement positif");
        }
        AnalysisPeriod period = resolvePeriod(from, to, Instant.now());
        Double maxPowerKw = sensorThreshold(sensorId);
        List<MeasurementPoint> points = measurementReader.findBySensorBetween(sensorId, period.from(), period.to());

        List<Anomaly> anomalies = anomalyDetector.detectAll(points, maxPowerKw, zThreshold);

        return AnomalyReportResponse.of(sensorId, period.from(), period.to(), points.size(),
                maxPowerKw, zThreshold, BASIC_METHODS,
                anomalies.stream().map(AnomalyResponse::from).toList());
    }

    /**
     * Détection complète des anomalies incluant variations de puissance, tension et température.
     */
    public AnomalyReportResponse allAnomalies(
            String sensorId,
            Instant from,
            Instant to,
            double zThreshold,
            double variationThreshold,
            double minVoltage,
            double maxVoltage,
            double maxTemperature) {

        if (!Double.isFinite(zThreshold) || zThreshold <= 0) {
            throw new InvalidAnalyticsRequestException("Le seuil z doit être strictement positif");
        }
        if (!Double.isFinite(variationThreshold) || variationThreshold <= 0) {
            throw new InvalidAnalyticsRequestException("Le seuil de variation doit être strictement positif");
        }
        if (!Double.isFinite(minVoltage) || minVoltage <= 0) {
            throw new InvalidAnalyticsRequestException("La tension minimale doit être strictement positive");
        }
        if (!Double.isFinite(maxVoltage) || maxVoltage <= minVoltage) {
            throw new InvalidAnalyticsRequestException("La tension maximale doit être strictement supérieure à la minimale");
        }
        if (!Double.isFinite(maxTemperature)) {
            throw new InvalidAnalyticsRequestException("La température maximale doit être un nombre");
        }

        AnalysisPeriod period = resolvePeriod(from, to, Instant.now());
        Double maxPowerKw = sensorThreshold(sensorId);
        List<MeasurementPoint> points = measurementReader.findBySensorBetween(sensorId, period.from(), period.to());

        List<Anomaly> anomalies = anomalyDetector.detectAllAnomalies(
                points, maxPowerKw, zThreshold, variationThreshold, minVoltage, maxVoltage, maxTemperature);

        return AnomalyReportResponse.of(sensorId, period.from(), period.to(), points.size(),
                maxPowerKw, zThreshold, List.of(AnomalyType.values()),
                anomalies.stream().map(AnomalyResponse::from).toList());
    }

    /**
     * Seuil du capteur ; lève ResourceNotFoundException (404) si le capteur est inconnu.
     * Un seuil absent ou non positif est ignoré (aucune anomalie de seuil).
     */
    private Double sensorThreshold(String sensorId) {
        Double maxPowerKw = sensorService.get(sensorId).maxPowerKw();
        return (maxPowerKw != null && maxPowerKw > 0) ? maxPowerKw : null;
    }

    /**
     * Valeurs par défaut : {@code to} = maintenant, {@code from} = {@code to} − 24 h.
     * Règles : from &lt; to et durée ≤ 31 jours.
     */
    static AnalysisPeriod resolvePeriod(Instant from, Instant to, Instant now) {
        Instant end = (to != null) ? to : now;
        Instant start = (from != null) ? from : end.minus(DEFAULT_PERIOD);

        if (!start.isBefore(end)) {
            throw new InvalidAnalyticsRequestException("'from' doit être strictement antérieur à 'to'");
        }
        if (Duration.between(start, end).compareTo(MAX_PERIOD) > 0) {
            throw new InvalidAnalyticsRequestException("La période ne peut pas dépasser 31 jours");
        }
        return new AnalysisPeriod(start, end);
    }

    /** Période d'analyse [from ; to[. */
    record AnalysisPeriod(Instant from, Instant to) {
    }
}
