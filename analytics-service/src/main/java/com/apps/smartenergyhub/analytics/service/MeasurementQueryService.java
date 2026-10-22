package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.dto.MeasurementResponse;
import com.apps.smartenergyhub.analytics.exception.BadRequestException;
import com.apps.smartenergyhub.analytics.exception.ResourceNotFoundException;
import com.apps.smartenergyhub.analytics.measurement.MeasurementRecord;
import com.apps.smartenergyhub.analytics.measurement.MeasurementRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Lecture des mesures brutes (Cassandra). MongoDB sert à vérifier que le capteur existe.
 */
@Service
@Profile("!mongo-only")
@RequiredArgsConstructor
public class MeasurementQueryService {

    static final Duration DEFAULT_PERIOD = Duration.ofHours(24);
    static final Duration MAX_PERIOD = Duration.ofDays(31);
    static final int DEFAULT_LIMIT = 1000;
    static final int MAX_LIMIT = 5000;
    static final int LATEST_LOOKBACK_DAYS = 7;

    private final SensorService sensorService;
    private final MeasurementRecordRepository repository;

    public List<MeasurementResponse> history(String sensorId, Instant from, Instant to, Integer limit) {
        sensorService.requireExists(sensorId);

        Instant end = (to != null) ? to : Instant.now();
        Instant start = (from != null) ? from : end.minus(DEFAULT_PERIOD);
        int max = (limit != null) ? limit : DEFAULT_LIMIT;

        if (!start.isBefore(end)) {
            throw new BadRequestException("'from' doit être strictement antérieur à 'to'");
        }
        if (Duration.between(start, end).compareTo(MAX_PERIOD) > 0) {
            throw new BadRequestException("La période ne peut pas dépasser 31 jours");
        }
        if (max < 1 || max > MAX_LIMIT) {
            throw new BadRequestException("limit doit être compris entre 1 et " + MAX_LIMIT);
        }

        LocalDate firstDay = LocalDate.ofInstant(start, ZoneOffset.UTC);
        LocalDate lastDay = LocalDate.ofInstant(end.minusNanos(1), ZoneOffset.UTC);

        List<MeasurementResponse> result = new ArrayList<>();
        // On part du jour le plus récent : les mesures sortent du plus récent au plus ancien
        for (LocalDate day = lastDay; !day.isBefore(firstDay) && result.size() < max; day = day.minusDays(1)) {
            for (MeasurementRecord r : repository.findInPartitionBetween(sensorId, day, start, end)) {
                if (result.size() >= max) {
                    break;
                }
                result.add(MeasurementResponse.from(r));
            }
        }
        return result;
    }

    public MeasurementResponse latest(String sensorId) {
        sensorService.requireExists(sensorId);

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (int i = 0; i < LATEST_LOOKBACK_DAYS; i++) {
            List<MeasurementRecord> rows = repository.findLatestInPartition(sensorId, today.minusDays(i));
            if (!rows.isEmpty()) {
                return MeasurementResponse.from(rows.get(0));
            }
        }
        throw new ResourceNotFoundException(
                "Aucune mesure sur les " + LATEST_LOOKBACK_DAYS + " derniers jours pour " + sensorId);
    }
}