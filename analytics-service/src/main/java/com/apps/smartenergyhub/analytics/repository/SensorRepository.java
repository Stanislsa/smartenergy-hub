package com.apps.smartenergyhub.analytics.repository;

import com.apps.smartenergyhub.analytics.entity.Sensor;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SensorRepository extends MongoRepository<Sensor, String> {

    Optional<Sensor> findBySensorId(String sensorId);

    boolean existsBySensorId(String sensorId);

    List<Sensor> findByBuilding(String building);

    List<Sensor> findByActive(boolean active);
}