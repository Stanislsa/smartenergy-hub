package com.apps.smartenergyhub.analytics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record SensorRequest(

        @Schema(example = "SENSOR-001")
        @NotBlank(message = "sensorId est obligatoire")
        @Pattern(regexp = "^[A-Za-z0-9_-]{3,50}$",
                 message = "sensorId : 3 à 50 caractères (lettres, chiffres, _ ou -)")
        String sensorId,

        @Schema(example = "Compteur salle serveur")
        @NotBlank(message = "name est obligatoire")
        String name,

        @Schema(example = "Bâtiment A")
        @NotBlank(message = "building est obligatoire")
        String building,

        @Schema(example = "1")
        Integer floor,

        @Schema(example = "8.0")
        @NotNull(message = "maxPowerKw est obligatoire")
        @Positive(message = "maxPowerKw doit être supérieur à 0")
        Double maxPowerKw,

        @Schema(example = "true")
        Boolean active,

        @Schema(example = "[\"critical\", \"server-room\"]")
        List<String> tags
) {}