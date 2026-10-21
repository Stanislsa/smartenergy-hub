package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.dto.DailySummaryResponse;
import com.apps.smartenergyhub.analytics.entity.DailySummary;
import com.apps.smartenergyhub.analytics.exception.ResourceNotFoundException;
import com.apps.smartenergyhub.analytics.repository.DailySummaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DailySummaryService {

    private final DailySummaryRepository repository;
    private final SensorService sensorService;

    public DailySummaryResponse get(String sensorId, LocalDate date) {
        sensorService.requireExists(sensorId);

        Optional<DailySummary> found = (date == null)
                ? repository.findFirstBySensorIdOrderByDateDesc(sensorId)
                : repository.findBySensorIdAndDate(sensorId, date.toString());

        DailySummary summary = found.orElseThrow(() -> new ResourceNotFoundException(
                "Aucun résumé quotidien pour " + sensorId + (date != null ? " le " + date : "")));

        return DailySummaryResponse.from(summary);
    }
}