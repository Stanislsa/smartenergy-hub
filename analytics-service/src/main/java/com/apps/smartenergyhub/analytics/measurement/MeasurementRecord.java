package com.apps.smartenergyhub.analytics.measurement;

import com.apps.smartenergyhub.analytics.reader.cassandra.MeasurementRowKey;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

/** Lecture seule de la table measurements_by_sensor_day (toutes les colonnes utiles). */
@Table("measurements_by_sensor_day")
@Getter
@Setter
@NoArgsConstructor
public class MeasurementRecord {

    @PrimaryKey
    private MeasurementRowKey key;

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
}