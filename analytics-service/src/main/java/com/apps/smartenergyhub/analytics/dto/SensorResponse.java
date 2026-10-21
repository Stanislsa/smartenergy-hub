package com.apps.smartenergyhub.analytics.dto;

import com.apps.smartenergyhub.analytics.entity.Sensor;

import java.time.Instant;
import java.util.List;

public record SensorResponse(
        String sensorId,
        String name,
        String building,
        Integer floor,
        Double maxPowerKw,
        boolean active,
        List<String> tags,
        Instant createdAt,
        Instant updatedAt
) {
    public static SensorResponse from(Sensor s) {
        return new SensorResponse(
                s.getSensorId(), s.getName(), s.getBuilding(), s.getFloor(),
                s.getMaxPowerKw(), s.isActive(), s.getTags(),
                s.getCreatedAt(), s.getUpdatedAt());
    }
}