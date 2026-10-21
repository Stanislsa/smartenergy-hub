package com.apps.smartenergyhub.storage.entity;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;

/**
 * Clé primaire composite pour l'entité MeasurementEntity.
 * Correspond à la clé primaire CQL : ((sensor_id, day), measured_at)
 * Partition : (sensor_id, day)
 * Clustering : measured_at DESC
 */
@PrimaryKeyClass
public class MeasurementKey implements Serializable {

    @PrimaryKeyColumn(
        name = "sensor_id",
        ordinal = 0,
        type = PrimaryKeyType.PARTITIONED
    )
    private String sensorId;

    @PrimaryKeyColumn(
        name = "day",
        ordinal = 1,
        type = PrimaryKeyType.PARTITIONED
    )
    private LocalDate day;

    @PrimaryKeyColumn(
        name = "measured_at",
        ordinal = 2,
        type = PrimaryKeyType.CLUSTERED
    )
    private Instant measuredAt;

    public MeasurementKey() {}

    public MeasurementKey(
            String sensorId,
            LocalDate day,
            Instant measuredAt) {
        this.sensorId = sensorId;
        this.day = day;
        this.measuredAt = measuredAt;
    }

    public String getSensorId() { return sensorId; }
    public LocalDate getDay() { return day; }
    public Instant getMeasuredAt() { return measuredAt; }

    public void setSensorId(String sensorId) {
        this.sensorId = sensorId;
    }

    public void setDay(LocalDate day) {
        this.day = day;
    }

    public void setMeasuredAt(Instant measuredAt) {
        this.measuredAt = measuredAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MeasurementKey that)) return false;
        return Objects.equals(sensorId, that.sensorId)
            && Objects.equals(day, that.day)
            && Objects.equals(measuredAt, that.measuredAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sensorId, day, measuredAt);
    }
}
