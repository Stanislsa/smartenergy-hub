package com.apps.smartenergyhub.collector.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;

@Schema(description = "Mesure envoyée par un capteur")
public record EnergyMeasurementRequest(

        @Schema(description = "Identifiant du capteur", example = "SENSOR-001")
        @NotBlank(message = "ne doit pas être vide") String sensorId,

        @Schema(description = "Date de la mesure (ISO 8601, UTC)", example = "2026-09-30T08:15:00Z")
        @NotNull(message = "est obligatoire") Instant timestamp,

        @Schema(description = "Puissance en kW (≥ 0)", example = "3.72")
        @NotNull(message = "est obligatoire")
        @PositiveOrZero(message = "doit être supérieur ou égal à 0") Double powerKw,

        @Schema(description = "Tension en V (≥ 0)", example = "226.4")
        @NotNull(message = "est obligatoire")
        @DecimalMin(value = "0.0", message = "doit être supérieur ou égal à 0") Double voltage,

        @Schema(description = "Courant en A (facultatif)", example = "16.4")
        @PositiveOrZero(message = "doit être supérieur ou égal à 0") Double current,

        @Schema(description = "Fréquence en Hz (facultatif)", example = "50.0")
        @Positive(message = "doit être supérieur à 0") Double frequency,

        @Schema(description = "Température en °C (facultatif)", example = "29.1")
        Double temperature
) {}