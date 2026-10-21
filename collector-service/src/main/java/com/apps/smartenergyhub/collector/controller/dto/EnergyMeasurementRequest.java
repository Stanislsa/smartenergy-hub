package com.apps.smartenergyhub.collector.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;

public record EnergyMeasurementRequest(
        @NotBlank(message = "ne doit pas être vide") String sensorId,
        @NotNull(message = "est obligatoire") Instant timestamp,
        @NotNull(message = "est obligatoire") @PositiveOrZero(message = "doit être supérieur ou égal à 0") Double powerKw,
        @NotNull(message = "est obligatoire") @DecimalMin(value = "0.0", message = "doit être supérieur ou égal à 0") Double voltage,
        @PositiveOrZero(message = "doit être supérieur ou égal à 0") Double current,
        @Positive(message = "doit être supérieur à 0") Double frequency,
        Double temperature
) {}