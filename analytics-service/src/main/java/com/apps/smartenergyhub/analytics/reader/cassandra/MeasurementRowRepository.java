package com.apps.smartenergyhub.analytics.reader.cassandra;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Accès en lecture à {@code measurements_by_sensor_day}.
 *
 * <p>La requête cible <b>une seule partition</b> (sensor_id, day) et filtre sur la colonne
 * de clustering {@code measured_at} : c'est le modèle d'accès prévu par la table, sans
 * ALLOW FILTERING.</p>
 */
public interface MeasurementRowRepository extends CassandraRepository<MeasurementRow, MeasurementRowKey> {

    @Query("SELECT * FROM measurements_by_sensor_day "
            + "WHERE sensor_id = ?0 AND day = ?1 AND measured_at >= ?2 AND measured_at < ?3")
    List<MeasurementRow> findInPartitionBetween(String sensorId, LocalDate day, Instant from, Instant to);
}
