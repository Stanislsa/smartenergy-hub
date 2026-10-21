package com.apps.smartenergyhub.analytics.controller;

import com.apps.smartenergyhub.analytics.dto.AnalyticsSummaryResponse;
import com.apps.smartenergyhub.analytics.dto.AnomalyReportResponse;
import com.apps.smartenergyhub.analytics.exception.InvalidAnalyticsRequestException;
import com.apps.smartenergyhub.analytics.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * API de lecture du module Analytics (Étape 9 du sujet).
 *
 * <p>Dates au format ISO 8601 UTC, ex. {@code 2026-09-30T00:00:00Z}.
 * Sans paramètre, la période analysée correspond aux 24 dernières heures.</p>
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Tag(name = "Analytics", description = "Analyse descriptive et détection d'anomalies")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/{sensorId}/summary")
    @Operation(summary = "Indicateurs descriptifs d'un capteur sur une période",
            description = "Moyenne, minimum, maximum, nombre de mesures, énergie estimée (E ≈ Σ Pi·Δt) "
                    + "et nombre de dépassements du maxPowerKw du capteur.")
    @ApiResponse(responseCode = "200", description = "Indicateurs calculés")
    @ApiResponse(responseCode = "400", description = "Période invalide")
    @ApiResponse(responseCode = "404", description = "Capteur introuvable")
    public AnalyticsSummaryResponse summary(
            @PathVariable String sensorId,
            @Parameter(description = "Début, inclus (défaut : to − 24 h)", example = "2026-09-30T00:00:00Z")
            @RequestParam(required = false) Instant from,
            @Parameter(description = "Fin, exclue (défaut : maintenant)", example = "2026-10-01T00:00:00Z")
            @RequestParam(required = false) Instant to) {
        return analyticsService.summary(sensorId, from, to);
    }

    @GetMapping("/{sensorId}/anomalies")
    @Operation(summary = "Anomalies d'un capteur sur une période",
            description = "Méthode 1 : P > maxPowerKw du capteur. "
                    + "Méthode 2 : |z| > seuil, avec z = (P − µ) / σ (seuil par défaut : 3).")
    @ApiResponse(responseCode = "200", description = "Anomalies détectées (liste éventuellement vide)")
    @ApiResponse(responseCode = "400", description = "Période ou seuil z invalide")
    @ApiResponse(responseCode = "404", description = "Capteur introuvable")
    public AnomalyReportResponse anomalies(
            @PathVariable String sensorId,
            @Parameter(description = "Début, inclus (défaut : to − 24 h)", example = "2026-09-30T00:00:00Z")
            @RequestParam(required = false) Instant from,
            @Parameter(description = "Fin, exclue (défaut : maintenant)", example = "2026-10-01T00:00:00Z")
            @RequestParam(required = false) Instant to,
            @Parameter(description = "Seuil sur |z|", example = "3")
            @RequestParam(name = "z", defaultValue = "3") double zThreshold) {
        return analyticsService.anomalies(sensorId, from, to, zThreshold);
    }

    /** 400 avec le même format JSON que le GlobalExceptionHandler du projet. */
    @ExceptionHandler(InvalidAnalyticsRequestException.class)
    public ResponseEntity<Map<String, Object>> invalidRequest(InvalidAnalyticsRequestException ex) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", ex.getMessage()));
    }
}
