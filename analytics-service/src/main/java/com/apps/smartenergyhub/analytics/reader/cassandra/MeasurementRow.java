package com.apps.smartenergyhub.analytics.reader.cassandra;

import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

/**
 * Ligne de la table {@code measurements_by_sensor_day}, réduite aux colonnes
 * utiles aux calculs Analytics (horodatage, puissance, tension, température). Lecture seule.
 */
@Table("measurements_by_sensor_day")
public class MeasurementRow {

    @PrimaryKey
    private MeasurementRowKey key;

    @Column("power_kw")
    private Double powerKw;

    @Column("voltage")
    private Double voltage;

    @Column("temperature")
    private Double temperature;

    public MeasurementRow() {
    }

    public MeasurementRow(MeasurementRowKey key, Double powerKw) {
        this(key, powerKw, null, null);
    }

    public MeasurementRow(MeasurementRowKey key, Double powerKw, Double voltage, Double temperature) {
        this.key = key;
        this.powerKw = powerKw;
        this.voltage = voltage;
        this.temperature = temperature;
    }

    public MeasurementRowKey getKey() { return key; }
    public void setKey(MeasurementRowKey key) { this.key = key; }

    public Double getPowerKw() { return powerKw; }
    public void setPowerKw(Double powerKw) { this.powerKw = powerKw; }

    public Double getVoltage() { return voltage; }
    public void setVoltage(Double voltage) { this.voltage = voltage; }

    public Double getTemperature() { return temperature; }
    public void setTemperature(Double temperature) { this.temperature = temperature; }
}
