package com.apps.smartenergyhub.storage.repository;

import com.apps.smartenergyhub.storage.entity.MeasurementEntity;
import com.apps.smartenergyhub.storage.entity.MeasurementKey;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * Repository Spring Data Cassandra pour les mesures énergétiques.
 * Fournit des méthodes pour interagir avec la table measurements_by_sensor_day.
 */
@Repository
public interface MeasurementRepository extends CassandraRepository<MeasurementEntity, MeasurementKey> {

    /**
     * Récupère toutes les mesures d'un capteur pour une journée spécifique.
     * @param sensorId Identifiant du capteur
     * @param day Date de la journée
     * @return Liste des mesures
     */
    List<MeasurementEntity> findByKeySensorIdAndKeyDay(String sensorId, LocalDate day);

    /** Lit uniquement les lignes les plus récentes de la partition (ordre défini par le schéma). */
    @Query("SELECT * FROM measurements_by_sensor_day WHERE sensor_id = ?0 AND day = ?1 LIMIT ?2")
    List<MeasurementEntity> findLatestBySensorAndDay(String sensorId, LocalDate day, int limit);
}
