package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.dto.SensorRequest;
import com.apps.smartenergyhub.analytics.dto.SensorResponse;
import com.apps.smartenergyhub.analytics.dto.SensorUpdateRequest;
import com.apps.smartenergyhub.analytics.entity.Sensor;
import com.apps.smartenergyhub.analytics.exception.DuplicateSensorException;
import com.apps.smartenergyhub.analytics.exception.ResourceNotFoundException;
import com.apps.smartenergyhub.analytics.repository.SensorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SensorService {

    private final SensorRepository repository;

    public SensorResponse create(SensorRequest req) {
        if (repository.existsBySensorId(req.sensorId())) {
            throw new DuplicateSensorException(req.sensorId());
        }
        Instant now = Instant.now();
        Sensor sensor = Sensor.builder()
                .sensorId(req.sensorId())
                .name(req.name())
                .building(req.building())
                .floor(req.floor())
                .maxPowerKw(req.maxPowerKw())
                .active(req.active() == null || req.active())
                .tags(req.tags() == null ? List.of() : req.tags())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return SensorResponse.from(repository.save(sensor));
    }

    public List<SensorResponse> findAll(String building, Boolean active) {
        List<Sensor> result;
        if (building != null) {
            result = repository.findByBuilding(building);
        } else if (active != null) {
            result = repository.findByActive(active);
        } else {
            result = repository.findAll();
        }
        return result.stream().map(SensorResponse::from).toList();
    }

    public SensorResponse get(String sensorId) {
        return SensorResponse.from(getOrThrow(sensorId));
    }

    public SensorResponse update(String sensorId, SensorUpdateRequest req) {
        Sensor sensor = getOrThrow(sensorId);
        sensor.setName(req.name());
        sensor.setBuilding(req.building());
        sensor.setFloor(req.floor());
        sensor.setMaxPowerKw(req.maxPowerKw());
        if (req.active() != null) {
            sensor.setActive(req.active());
        }
        sensor.setTags(req.tags() == null ? List.of() : req.tags());
        sensor.setUpdatedAt(Instant.now());
        return SensorResponse.from(repository.save(sensor));
    }

    /** Vérifie qu'un capteur existe (réutilisé par les autres services). */
    public void requireExists(String sensorId) {
        getOrThrow(sensorId);
    }

    private Sensor getOrThrow(String sensorId) {
        return repository.findBySensorId(sensorId)
                .orElseThrow(() -> new ResourceNotFoundException("Capteur introuvable : " + sensorId));
    }
}