package com.apps.smartenergyhub.analytics.controller;

import com.apps.smartenergyhub.analytics.dto.MeasurementResponse;
import com.apps.smartenergyhub.analytics.service.MeasurementQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/measurements")
@Profile("!mongo-only")
@RequiredArgsConstructor
@Tag(name = "Mesures", description = "Consultation des mesures brutes (Cassandra)")
public class MeasurementController {

    private final MeasurementQueryService queryService;

    @GetMapping("/{sensorId}")
    @Operation(summary = "Historique des mesures d'un capteur (plus récentes d'abord)")
    public List<MeasurementResponse> history(
            @PathVariable String sensorId,
            @Parameter(description = "Début, inclus (défaut : to − 24 h)", example = "2026-10-22T00:00:00Z")
            @RequestParam(required = false) Instant from,
            @Parameter(description = "Fin, exclue (défaut : maintenant)", example = "2026-10-23T00:00:00Z")
            @RequestParam(required = false) Instant to,
            @Parameter(description = "Nombre maximum de mesures (1 à 5000, défaut 1000)", example = "100")
            @RequestParam(required = false) Integer limit) {
        return queryService.history(sensorId, from, to, limit);
    }

    @GetMapping("/{sensorId}/latest")
    @Operation(summary = "Dernière mesure connue d'un capteur")
    public MeasurementResponse latest(@PathVariable String sensorId) {
        return queryService.latest(sensorId);
    }
}