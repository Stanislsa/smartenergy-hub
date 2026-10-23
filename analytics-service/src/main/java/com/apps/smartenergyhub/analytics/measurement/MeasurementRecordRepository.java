package com.apps.smartenergyhub.analytics.measurement;

import com.apps.smartenergyhub.analytics.reader.cassandra.MeasurementRowKey;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface MeasurementRecordRepository extends CassandraRepository<MeasurementRecord, MeasurementRowKey> {

    /** Une seule partition (capteur, jour), plus récent d'abord (CLUSTERING ORDER BY ... DESC). */
    @Query("SELECT * FROM measurements_by_sensor_day "
            + "WHERE sensor_id = ?0 AND day = ?1 AND measured_at >= ?2 AND measured_at < ?3 LIMIT 5000")
    List<MeasurementRecord> findInPartitionBetween(String sensorId, LocalDate day, Instant from, Instant to);

    /** La mesure la plus récente d'une journée. */
    @Query("SELECT * FROM measurements_by_sensor_day WHERE sensor_id = ?0 AND day = ?1 LIMIT 1")
    List<MeasurementRecord> findLatestInPartition(String sensorId, LocalDate day);
}