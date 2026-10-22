package com.apps.smartenergyhub.collector.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.time.Instant;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class EnergyMeasurementRequestTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private Set<ConstraintViolation<EnergyMeasurementRequest>> validate(EnergyMeasurementRequest request) {
        return validator.validate(request);
    }

    private boolean violationOn(Set<ConstraintViolation<EnergyMeasurementRequest>> violations, String field) {
        return violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals(field));
    }

    @Test
    void mesureValideEstAcceptee() {
        var request = new EnergyMeasurementRequest(
                "SENSOR-001", Instant.parse("2026-09-30T08:15:00Z"),
                3.72, 226.4, 16.4, 50.0, 29.1);

        assertThat(validate(request)).isEmpty();
    }

    @Test
    void champsFacultatifsAbsentsRestentValides() {
        var request = new EnergyMeasurementRequest(
                "SENSOR-001", Instant.parse("2026-09-30T08:15:00Z"),
                3.72, 226.4, null, null, null);

        assertThat(validate(request)).isEmpty();
    }

    @Test
    void sensorIdVideEstRejete() {
        var request = new EnergyMeasurementRequest(
                "  ", Instant.parse("2026-09-30T08:15:00Z"),
                3.72, 226.4, null, null, null);

        assertThat(violationOn(validate(request), "sensorId")).isTrue();
    }

    @Test
    void sensorIdAbsentEstRejete() {
        var request = new EnergyMeasurementRequest(
                null, Instant.parse("2026-09-30T08:15:00Z"),
                3.72, 226.4, null, null, null);

        assertThat(violationOn(validate(request), "sensorId")).isTrue();
    }

    @Test
    void timestampAbsentEstRejete() {
        var request = new EnergyMeasurementRequest(
                "SENSOR-001", null, 3.72, 226.4, null, null, null);

        assertThat(violationOn(validate(request), "timestamp")).isTrue();
    }

    @Test
    void puissanceNegativeEstRejetee() {
        var request = new EnergyMeasurementRequest(
                "SENSOR-001", Instant.parse("2026-09-30T08:15:00Z"),
                -1.0, 226.4, null, null, null);

        assertThat(violationOn(validate(request), "powerKw")).isTrue();
    }

    @Test
    void tensionNegativeEstRejetee() {
        var request = new EnergyMeasurementRequest(
                "SENSOR-001", Instant.parse("2026-09-30T08:15:00Z"),
                3.72, -5.0, null, null, null);

        assertThat(violationOn(validate(request), "voltage")).isTrue();
    }

    @Test
    void frequenceNulleEstRejetee() {
        var request = new EnergyMeasurementRequest(
                "SENSOR-001", Instant.parse("2026-09-30T08:15:00Z"),
                3.72, 226.4, null, 0.0, null);

        assertThat(violationOn(validate(request), "frequency")).isTrue();
    }
}