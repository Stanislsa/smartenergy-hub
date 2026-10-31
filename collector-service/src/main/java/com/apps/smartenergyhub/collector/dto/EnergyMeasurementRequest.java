package com.apps.smartenergyhub.collector.dto;

import com.apps.smartenergyhub.collector.validation.PlausibleTimestamp;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

@Schema(description = "Mesure envoyée par un capteur")
public record EnergyMeasurementRequest(

        @Schema(description = "Identifiant du capteur", example = "SENSOR-001")
        @NotBlank(message = "ne doit pas être vide") String sensorId,

        @Schema(description = "Date de la mesure (ISO 8601, UTC). Acceptée de 365 jours dans le passé à 5 minutes dans le futur",
                example = "2026-09-30T08:15:00Z")
        @NotNull(message = "est obligatoire")
        @PlausibleTimestamp Instant timestamp,

        @Schema(description = "Puissance en kW (0 à 1000)", example = "3.72")
        @NotNull(message = "est obligatoire")
        @DecimalMin(value = "0.0", message = "doit être supérieur ou égal à 0")
        @DecimalMax(value = "1000.0", message = "doit être inférieur ou égal à 1000 kW") Double powerKw,

        @Schema(description = "Tension en V (0 à 500)", example = "226.4")
        @NotNull(message = "est obligatoire")
        @DecimalMin(value = "0.0", message = "doit être supérieur ou égal à 0")
        @DecimalMax(value = "500.0", message = "doit être inférieur ou égal à 500 V") Double voltage,

        @Schema(description = "Courant en A (facultatif, 0 à 2000)", example = "16.4")
        @DecimalMin(value = "0.0", message = "doit être supérieur ou égal à 0")
        @DecimalMax(value = "2000.0", message = "doit être inférieur ou égal à 2000 A") Double current,

        @Schema(description = "Fréquence en Hz (facultatif, 40 à 70)", example = "50.0")
        @DecimalMin(value = "40.0", message = "doit être supérieur ou égal à 40 Hz")
        @DecimalMax(value = "70.0", message = "doit être inférieur ou égal à 70 Hz") Double frequency,

        @Schema(description = "Température en °C (facultatif, -50 à 100)", example = "29.1")
        @DecimalMin(value = "-50.0", message = "doit être supérieur ou égal à -50 °C")
        @DecimalMax(value = "100.0", message = "doit être inférieur ou égal à 100 °C") Double temperature
) {}