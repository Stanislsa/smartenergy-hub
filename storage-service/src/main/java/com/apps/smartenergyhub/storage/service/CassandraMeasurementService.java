package com.apps.smartenergyhub.storage.service;

import com.apps.smartenergyhub.storage.entity.MeasurementEntity;
import com.apps.smartenergyhub.storage.entity.MeasurementKey;
import com.apps.smartenergyhub.storage.repository.MeasurementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;

/**
 * Service de persistance des mesures dans Cassandra.
 * Gère l'écriture et la lecture des mesures énergétiques.
 */
@Service
@RequiredArgsConstructor
public class CassandraMeasurementService {

    private final MeasurementRepository measurementRepository;

    /**
     * Enregistre une mesure dans Cassandra.
     * La clé de partition est (sensor_id, day) pour optimiser les lectures.
     * 
     * @param sensorId Identifiant du capteur
     * @param timestamp Horodatage de la mesure
     * @param powerKw Puissance en kW
     * @param voltage Tension en V
     * @param current Courant en A
     * @param frequency Fréquence en Hz
     * @param temperature Température en °C
     */
    public void saveMeasurement(String sensorId, Instant timestamp, Double powerKw, 
                                 Double voltage, Double current, Double frequency, Double temperature) {
        if (sensorId == null || sensorId.isBlank()) {
            throw new IllegalArgumentException("sensorId ne peut pas être vide");
        }
        if (timestamp == null) {
            throw new IllegalArgumentException("timestamp est obligatoire");
        }
        if (powerKw == null || !Double.isFinite(powerKw) || powerKw < 0) {
            throw new IllegalArgumentException("powerKw doit être une valeur finie positive ou nulle");
        }
        LocalDate day = timestamp.atZone(ZoneOffset.UTC).toLocalDate();
        UUID recordId = UUID.randomUUID();
        
        MeasurementKey key = new MeasurementKey(sensorId, day, timestamp);
        MeasurementEntity entity = new MeasurementEntity(
            key, powerKw, voltage, current, frequency, temperature, recordId
        );
        
        measurementRepository.save(entity);
        System.out.println("Mesure enregistrée dans Cassandra - Sensor: " + sensorId + ", Day: " + day + ", RecordId: " + recordId);
    }

    /**
     * Récupère l'historique des mesures d'un capteur pour une journée.
     * 
     * @param sensorId Identifiant du capteur
     * @param day Date de la journée
     * @return Liste des mesures triées par measured_at DESC
     */
    public List<MeasurementEntity> getMeasurementsByDay(String sensorId, LocalDate day) {
        System.out.println("Récupération des mesures - Sensor: " + sensorId + ", Day: " + day);
        return measurementRepository.findByKeySensorIdAndKeyDay(sensorId, day);
    }

    /**
     * Récupère les N dernières mesures d'un capteur pour la journée actuelle.
     * 
     * @param sensorId Identifiant du capteur
     * @param limit Nombre maximum de résultats
     * @return Liste des mesures
     */
    public List<MeasurementEntity> getLatestMeasurements(String sensorId, int limit) {
        if (sensorId == null || sensorId.isBlank()) {
            throw new IllegalArgumentException("sensorId ne peut pas être vide");
        }
        if (limit < 1) {
            throw new IllegalArgumentException("limit doit être supérieur à zéro");
        }
        LocalDate day = LocalDate.now(ZoneOffset.UTC);
        List<MeasurementEntity> latest = new ArrayList<>(limit);
        int daysChecked = 0;
        while (latest.size() < limit && daysChecked < 7) {
            int remaining = limit - latest.size();
            latest.addAll(measurementRepository.findLatestBySensorAndDay(sensorId, day, remaining));
            day = day.minusDays(1);
            daysChecked++;
        }
        return latest;
    }
}
