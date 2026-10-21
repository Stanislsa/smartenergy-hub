package com.apps.smartenergyhub.analytics.dto;

import com.apps.smartenergyhub.analytics.entity.DailySummary;

public record DailySummaryResponse(
        String sensorId,
        String date,
        Double avgPowerKw,
        Double maxPowerKw,
        Double energyKwh,
        Integer anomalyCount
) {
    public static DailySummaryResponse from(DailySummary d) {
        return new DailySummaryResponse(
                d.getSensorId(), d.getDate(), d.getAvgPowerKw(),
                d.getMaxPowerKw(), d.getEnergyKwh(), d.getAnomalyCount());
    }
}