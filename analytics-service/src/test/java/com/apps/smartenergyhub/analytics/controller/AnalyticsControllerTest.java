package com.apps.smartenergyhub.analytics.controller;

import com.apps.smartenergyhub.analytics.calculator.AnomalyType;
import com.apps.smartenergyhub.analytics.dto.AnalyticsSummaryResponse;
import com.apps.smartenergyhub.analytics.dto.AnomalyReportResponse;
import com.apps.smartenergyhub.analytics.dto.AnomalyResponse;
import com.apps.smartenergyhub.analytics.exception.InvalidAnalyticsRequestException;
import com.apps.smartenergyhub.analytics.exception.ResourceNotFoundException;
import com.apps.smartenergyhub.analytics.service.AnalyticsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalyticsController.class)
class AnalyticsControllerTest {

    private static final Instant FROM = Instant.parse("2026-09-30T00:00:00Z");
    private static final Instant TO = Instant.parse("2026-10-01T00:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AnalyticsService analyticsService;

    @Test
    @DisplayName("GET /summary → 200 avec les indicateurs en JSON")
    void summaryOk() throws Exception {
        when(analyticsService.summary("SENSOR-001", FROM, TO)).thenReturn(new AnalyticsSummaryResponse(
                "SENSOR-001", FROM, TO, 288, 3.5, 1.8, 14.4, 84.8, 8.0, 1));

        mockMvc.perform(get("/api/analytics/SENSOR-001/summary")
                        .param("from", "2026-09-30T00:00:00Z")
                        .param("to", "2026-10-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensorId").value("SENSOR-001"))
                .andExpect(jsonPath("$.from").value("2026-09-30T00:00:00Z"))
                .andExpect(jsonPath("$.measurementCount").value(288))
                .andExpect(jsonPath("$.energyKwh").value(84.8))
                .andExpect(jsonPath("$.thresholdExceedances").value(1));
    }

    @Test
    @DisplayName("GET /summary sans paramètres → la période par défaut est déléguée au service")
    void summaryWithoutParams() throws Exception {
        when(analyticsService.summary("SENSOR-001", null, null)).thenReturn(new AnalyticsSummaryResponse(
                "SENSOR-001", FROM, TO, 0, null, null, null, 0.0, 8.0, 0));

        mockMvc.perform(get("/api/analytics/SENSOR-001/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.measurementCount").value(0));
    }

    @Test
    @DisplayName("GET /anomalies?z=2.5 → 200, le seuil z est transmis au service")
    void anomaliesOk() throws Exception {
        Instant spike = Instant.parse("2026-09-30T14:00:00Z");
        when(analyticsService.anomalies(eq("SENSOR-001"), eq(FROM), eq(TO), eq(2.5))).thenReturn(
                new AnomalyReportResponse("SENSOR-001", FROM, TO, 288, 8.0, 2.5, 1, 1, List.of(
                        new AnomalyResponse(spike, 14.4, AnomalyType.THRESHOLD, 1.8, 8.0),
                        new AnomalyResponse(spike, 14.4, AnomalyType.Z_SCORE, 9.1, 2.5))));

        mockMvc.perform(get("/api/analytics/SENSOR-001/anomalies")
                        .param("from", "2026-09-30T00:00:00Z")
                        .param("to", "2026-10-01T00:00:00Z")
                        .param("z", "2.5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anomalies.length()").value(2))
                .andExpect(jsonPath("$.anomalies[0].method").value("THRESHOLD"))
                .andExpect(jsonPath("$.anomalies[1].method").value("Z_SCORE"));

        verify(analyticsService).anomalies("SENSOR-001", FROM, TO, 2.5);
    }

    @Test
    @DisplayName("Capteur inconnu → 404")
    void unknownSensor() throws Exception {
        when(analyticsService.summary(eq("SENSOR-999"), any(), any()))
                .thenThrow(new ResourceNotFoundException("Capteur introuvable : SENSOR-999"));

        mockMvc.perform(get("/api/analytics/SENSOR-999/summary"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Capteur introuvable : SENSOR-999"));
    }

    @Test
    @DisplayName("Période invalide → 400 avec message")
    void invalidPeriod() throws Exception {
        when(analyticsService.summary(eq("SENSOR-001"), any(), any()))
                .thenThrow(new InvalidAnalyticsRequestException("'from' doit être strictement antérieur à 'to'"));

        mockMvc.perform(get("/api/analytics/SENSOR-001/summary")
                        .param("from", "2026-10-01T00:00:00Z")
                        .param("to", "2026-09-30T00:00:00Z"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("'from' doit être strictement antérieur à 'to'"));
    }

    @Test
    @DisplayName("Date mal formée → 400")
    void malformedDate() throws Exception {
        mockMvc.perform(get("/api/analytics/SENSOR-001/summary").param("from", "hier"))
                .andExpect(status().isBadRequest());
    }
}
