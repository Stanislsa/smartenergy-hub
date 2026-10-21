package com.apps.smartenergyhub.analytics.reader.cassandra;

import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

/**
 * Ligne de la table {@code measurements_by_sensor_day}, réduite aux colonnes
 * utiles aux calculs Analytics (horodatage et puissance). Lecture seule.
 */
@Table("measurements_by_sensor_day")
public class MeasurementRow {

    @PrimaryKey
    private MeasurementRowKey key;

    @Column("power_kw")
    private Double powerKw;

    public MeasurementRow() {
    }

    public MeasurementRow(MeasurementRowKey key, Double powerKw) {
        this.key = key;
        this.powerKw = powerKw;
    }

    public MeasurementRowKey getKey() { return key; }
    public void setKey(MeasurementRowKey key) { this.key = key; }

    public Double getPowerKw() { return powerKw; }
    public void setPowerKw(Double powerKw) { this.powerKw = powerKw; }
}
