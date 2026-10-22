package com.apps.smartenergyhub.collector.controller;

import com.apps.smartenergyhub.collector.dto.EnergyMeasurementRequest;
import com.apps.smartenergyhub.collector.service.MeasurementPublisher;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/measurements")
@Tag(name = "Mesures", description = "Réception des mesures des capteurs")
public class MeasurementController {

    private final MeasurementPublisher publisher;

    public MeasurementController(MeasurementPublisher publisher) {
        this.publisher = publisher;
    }

    @PostMapping
    @Operation(summary = "Envoyer une mesure",
            description = "Valide la mesure puis la publie dans le stream Redis `energy-measurements`.")
    @ApiResponse(responseCode = "202", description = "Mesure acceptée et publiée dans Redis")
    @ApiResponse(responseCode = "400", description = "Mesure invalide ou JSON illisible",
            content = @Content(examples = @ExampleObject(value = """
                    {
                      "status": 400,
                      "error": "Validation failed",
                      "details": ["sensorId : ne doit pas être vide"]
                    }""")))
    @ApiResponse(responseCode = "503", description = "Redis indisponible")
    public ResponseEntity<Void> receive(@Valid @RequestBody EnergyMeasurementRequest request) {
        publisher.publish(request);
        return ResponseEntity.accepted().build();
    }
}