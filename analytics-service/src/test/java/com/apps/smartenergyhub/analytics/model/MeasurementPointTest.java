package com.apps.smartenergyhub.analytics.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MeasurementPointTest {

    private static final Instant T0 = Instant.parse("2026-09-30T08:15:00Z");

    @Test
    @DisplayName("Mesure valide acceptée (puissance nulle autorisée)")
    void validMeasurement() {
        assertThatCode(() -> new MeasurementPoint(T0, 3.72)).doesNotThrowAnyException();
        assertThatCode(() -> new MeasurementPoint(T0, 0.0)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Horodatage obligatoire")
    void timestampRequired() {
        assertThatThrownBy(() -> new MeasurementPoint(null, 1.0))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    @DisplayName("Puissance négative ou non finie refusée")
    void invalidPower() {
        assertThatThrownBy(() -> new MeasurementPoint(T0, -0.1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MeasurementPoint(T0, Double.NaN))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
