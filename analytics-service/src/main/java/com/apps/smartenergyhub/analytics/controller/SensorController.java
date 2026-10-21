package com.apps.smartenergyhub.analytics.controller;

import com.apps.smartenergyhub.analytics.dto.DailySummaryResponse;
import com.apps.smartenergyhub.analytics.dto.SensorRequest;
import com.apps.smartenergyhub.analytics.dto.SensorResponse;
import com.apps.smartenergyhub.analytics.dto.SensorUpdateRequest;
import com.apps.smartenergyhub.analytics.service.DailySummaryService;
import com.apps.smartenergyhub.analytics.service.SensorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/sensors")
@RequiredArgsConstructor
@Tag(name = "Capteurs", description = "Métadonnées des capteurs (MongoDB)")
public class SensorController {

    private final SensorService sensorService;
    private final DailySummaryService summaryService;

    @PostMapping
    @Operation(summary = "Créer un capteur")
    public ResponseEntity<SensorResponse> create(@Valid @RequestBody SensorRequest request) {
        SensorResponse created = sensorService.create(request);
        return ResponseEntity
                .created(URI.create("/api/sensors/" + created.sensorId()))
                .body(created);
    }

    @GetMapping
    @Operation(summary = "Lister les capteurs (filtres optionnels : building, active)")
    public List<SensorResponse> list(@RequestParam(required = false) String building,
                                     @RequestParam(required = false) Boolean active) {
        return sensorService.findAll(building, active);
    }

    @GetMapping("/{sensorId}")
    @Operation(summary = "Afficher un capteur")
    public SensorResponse get(@PathVariable String sensorId) {
        return sensorService.get(sensorId);
    }

    @PutMapping("/{sensorId}")
    @Operation(summary = "Modifier un capteur")
    public SensorResponse update(@PathVariable String sensorId,
                                 @Valid @RequestBody SensorUpdateRequest request) {
        return sensorService.update(sensorId, request);
    }

    @GetMapping("/{sensorId}/daily-summary")
    @Operation(summary = "Résumé quotidien (le plus récent si 'date' est absente)")
    public DailySummaryResponse dailySummary(
            @PathVariable String sensorId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return summaryService.get(sensorId, date);
    }
}