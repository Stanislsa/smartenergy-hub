package com.apps.smartenergyhub.analytics.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "daily_summaries")
@CompoundIndex(name = "sensor_date_idx", def = "{'sensorId': 1, 'date': -1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailySummary {

    @Id
    private String id;

    private String sensorId;
    private String date;            // format "2026-09-30", comme dans le guide
    private Double avgPowerKw;
    private Double maxPowerKw;
    private Double energyKwh;
    private Integer anomalyCount;
}