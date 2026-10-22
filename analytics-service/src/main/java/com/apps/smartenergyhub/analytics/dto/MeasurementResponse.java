package com.apps.smartenergyhub.analytics.dto;

import com.apps.smartenergyhub.analytics.measurement.MeasurementRecord;

import java.time.Instant;

public record MeasurementResponse(
        String sensorId,
        Instant timestamp,
        Double powerKw,
        Double voltage,
        Double current,
        Double frequency,
        Double temperature
) {
    public static MeasurementResponse from(MeasurementRecord r) {
        return new MeasurementResponse(
                r.getKey().getSensorId(), r.getKey().getMeasuredAt(),
                r.getPowerKw(), r.getVoltage(), r.getCurrent(),
                r.getFrequency(), r.getTemperature());
    }
}