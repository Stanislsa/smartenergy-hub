package com.apps.smartenergyhub.analytics.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

// Pour PUT : l'identifiant vient de l'URL, on ne le redemande pas
public record SensorUpdateRequest(

        @Schema(example = "Compteur salle serveur (modifié)")
        @NotBlank(message = "name est obligatoire")
        String name,

        @Schema(example = "Bâtiment A")
        @NotBlank(message = "building est obligatoire")
        String building,

        @Schema(example = "1")
        Integer floor,

        @Schema(example = "10.0")
        @NotNull(message = "maxPowerKw est obligatoire")
        @Positive(message = "maxPowerKw doit être supérieur à 0")
        Double maxPowerKw,

        @Schema(example = "true")
        Boolean active,

        @Schema(example = "[\"critical\"]")
        List<String> tags
) {}