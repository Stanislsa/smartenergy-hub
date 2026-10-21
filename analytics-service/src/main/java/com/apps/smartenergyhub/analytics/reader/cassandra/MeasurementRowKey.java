package com.apps.smartenergyhub.analytics.reader.cassandra;

import org.springframework.data.cassandra.core.cql.Ordering;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;

import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

/**
 * Clé primaire de la table {@code measurements_by_sensor_day} (créée par la partie B,
 * scripts/init-cassandra.cql) : {@code PRIMARY KEY ((sensor_id, day), measured_at)}.
 *
 * <p>Mapping en <b>lecture seule</b> propre au module Analytics : chaque service garde
 * son propre code, conformément à l'architecture en microservices.</p>
 */
@PrimaryKeyClass
public class MeasurementRowKey implements Serializable {

    @PrimaryKeyColumn(name = "sensor_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
    private String sensorId;

    /** Jour UTC de la mesure. */
    @PrimaryKeyColumn(name = "day", ordinal = 1, type = PrimaryKeyType.PARTITIONED)
    private LocalDate day;

    @PrimaryKeyColumn(name = "measured_at", ordinal = 2, type = PrimaryKeyType.CLUSTERED,
            ordering = Ordering.DESCENDING)
    private Instant measuredAt;

    public MeasurementRowKey() {
    }

    public MeasurementRowKey(String sensorId, LocalDate day, Instant measuredAt) {
        this.sensorId = sensorId;
        this.day = day;
        this.measuredAt = measuredAt;
    }

    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public LocalDate getDay() { return day; }
    public void setDay(LocalDate day) { this.day = day; }

    public Instant getMeasuredAt() { return measuredAt; }
    public void setMeasuredAt(Instant measuredAt) { this.measuredAt = measuredAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MeasurementRowKey that)) return false;
        return Objects.equals(sensorId, that.sensorId)
                && Objects.equals(day, that.day)
                && Objects.equals(measuredAt, that.measuredAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sensorId, day, measuredAt);
    }
}
