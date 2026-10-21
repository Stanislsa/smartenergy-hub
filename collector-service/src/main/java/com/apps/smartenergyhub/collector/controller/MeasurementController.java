package com.apps.smartenergyhub.collector.controller;

import com.apps.smartenergyhub.collector.dto.EnergyMeasurementRequest;
import com.apps.smartenergyhub.collector.service.MeasurementPublisher;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/measurements")
public class MeasurementController {

    private final MeasurementPublisher publisher;

    public MeasurementController(MeasurementPublisher publisher) {
        this.publisher = publisher;
    }

    @PostMapping
    public ResponseEntity<Void> receive(@Valid @RequestBody EnergyMeasurementRequest request) {
        publisher.publish(request);
        return ResponseEntity.accepted().build();
    }
}