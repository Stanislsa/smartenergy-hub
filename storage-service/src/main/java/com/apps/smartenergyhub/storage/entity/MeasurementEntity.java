package com.apps.smartenergyhub.storage.entity;

import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import java.util.UUID;

/**
 * Entité Cassandra pour les mesures énergétiques.
 * Table : measurements_by_sensor_day
 * Clé primaire : ((sensor_id, day), measured_at)
 */
@Table("measurements_by_sensor_day")
public class MeasurementEntity {

    @PrimaryKey
    private MeasurementKey key;

    @Column("power_kw")
    private Double powerKw;

    @Column("voltage")
    private Double voltage;

    @Column("current")
    private Double current;

    @Column("frequency")
    private Double frequency;

    @Column("temperature")
    private Double temperature;

    @Column("record_id")
    private UUID recordId;

    public MeasurementEntity() {}

    public MeasurementEntity(MeasurementKey key, Double powerKw, Double voltage, 
                             Double current, Double frequency, Double temperature, UUID recordId) {
        this.key = key;
        this.powerKw = powerKw;
        this.voltage = voltage;
        this.current = current;
        this.frequency = frequency;
        this.temperature = temperature;
        this.recordId = recordId;
    }

    // Getters et Setters
    public MeasurementKey getKey() { return key; }
    public void setKey(MeasurementKey key) { this.key = key; }

    public Double getPowerKw() { return powerKw; }
    public void setPowerKw(Double powerKw) { this.powerKw = powerKw; }

    public Double getVoltage() { return voltage; }
    public void setVoltage(Double voltage) { this.voltage = voltage; }

    public Double getCurrent() { return current; }
    public void setCurrent(Double current) { this.current = current; }

    public Double getFrequency() { return frequency; }
    public void setFrequency(Double frequency) { this.frequency = frequency; }

    public Double getTemperature() { return temperature; }
    public void setTemperature(Double temperature) { this.temperature = temperature; }

    public UUID getRecordId() { return recordId; }
    public void setRecordId(UUID recordId) { this.recordId = recordId; }
}
