package com.apps.smartenergyhub.analytics.repository;

import com.apps.smartenergyhub.analytics.entity.DailySummary;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface DailySummaryRepository extends MongoRepository<DailySummary, String> {

    Optional<DailySummary> findBySensorIdAndDate(String sensorId, String date);

    Optional<DailySummary> findFirstBySensorIdOrderByDateDesc(String sensorId);
}