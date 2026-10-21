package com.apps.smartenergyhub.storage.controller;

import com.apps.smartenergyhub.storage.entity.MeasurementEntity;
import com.apps.smartenergyhub.storage.service.CassandraMeasurementService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Controller de test pour Cassandra.
 * Permet de tester l'écriture et la lecture des mesures.
 */
@RestController
@RequestMapping("/api/cassandra/test")
@RequiredArgsConstructor
public class CassandraTestController {

    private final CassandraMeasurementService cassandraMeasurementService;

    /**
     * Endpoint de test pour écrire une mesure dans Cassandra.
     * POST /api/cassandra/test/write
     */
    @PostMapping("/write")
    public ResponseEntity<String> writeTestMeasurement() {
        try {
            String sensorId = "TEST-SENSOR-001";
            Instant timestamp = Instant.now();
            Double powerKw = 1.5;
            Double voltage = 230.0;
            Double current = 6.5;
            Double frequency = 50.0;
            Double temperature = 25.0;

            cassandraMeasurementService.saveMeasurement(
                sensorId, timestamp, powerKw, voltage, current, frequency, temperature
            );

            return ResponseEntity.ok("Mesure de test écrite dans Cassandra avec succès");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body("Erreur lors de l'écriture: " + e.getMessage());
        }
    }

    /**
     * Endpoint de test pour lire les mesures d'un capteur pour une journée.
     * GET /api/cassandra/test/read/{sensorId}?day=2024-10-21
     */
    @GetMapping("/read/{sensorId}")
    public ResponseEntity<List<MeasurementEntity>> readMeasurements(
            @PathVariable String sensorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day) {
        
        LocalDate targetDay = (day != null) ? day : LocalDate.now();
        List<MeasurementEntity> measurements = 
            cassandraMeasurementService.getMeasurementsByDay(sensorId, targetDay);
        
        return ResponseEntity.ok(measurements);
    }

    /**
     * Endpoint de test pour lire les N dernières mesures.
     * GET /api/cassandra/test/latest/{sensorId}?limit=10
     */
    @GetMapping("/latest/{sensorId}")
    public ResponseEntity<List<MeasurementEntity>> readLatestMeasurements(
            @PathVariable String sensorId,
            @RequestParam(defaultValue = "10") int limit) {
        
        List<MeasurementEntity> measurements = 
            cassandraMeasurementService.getLatestMeasurements(sensorId, limit);
        
        return ResponseEntity.ok(measurements);
    }
}
