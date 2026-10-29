package com.apps.smartenergyhub.analytics.security;

import com.apps.smartenergyhub.analytics.controller.SensorController;
import com.apps.smartenergyhub.analytics.dto.SensorResponse;
import com.apps.smartenergyhub.analytics.service.DailySummaryAggregationService;
import com.apps.smartenergyhub.analytics.service.DailySummaryService;
import com.apps.smartenergyhub.analytics.service.SensorService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SensorController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.security.enabled=true")
class SecurityRulesTest {

    private static final String SENSOR_JSON = """
            {"sensorId":"SENSOR-010","name":"Compteur test","building":"Bâtiment A",
             "floor":1,"maxPowerKw":8.0,"active":true,"tags":[]}
            """;

    @Autowired
    MockMvc mockMvc;

    @MockBean SensorService sensorService;
    @MockBean DailySummaryService dailySummaryService;
    @MockBean DailySummaryAggregationService aggregationService;
    @MockBean JwtDecoder jwtDecoder;

    private static SimpleGrantedAuthority role(String name) {
        return new SimpleGrantedAuthority("ROLE_" + name);
    }

    @Test
    void sansJeton_401() throws Exception {
        mockMvc.perform(get("/api/sensors"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void viewer_peutLire() throws Exception {
        mockMvc.perform(get("/api/sensors").with(jwt().authorities(role("VIEWER"))))
                .andExpect(status().isOk());
    }

    @Test
    void viewer_nePeutPasCreer_403() throws Exception {
        mockMvc.perform(post("/api/sensors").with(jwt().authorities(role("VIEWER")))
                        .contentType(MediaType.APPLICATION_JSON).content(SENSOR_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    void viewer_nePeutPasCalculerUnResume_403() throws Exception {
        mockMvc.perform(post("/api/sensors/SENSOR-001/daily-summary/compute")
                        .param("date", "2026-09-30").with(jwt().authorities(role("VIEWER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void admin_peutCreer() throws Exception {
        when(sensorService.create(any())).thenReturn(new SensorResponse(
                "SENSOR-010", "Compteur test", "Bâtiment A", 1, 8.0, true, List.of(), null, null));

        mockMvc.perform(post("/api/sensors").with(jwt().authorities(role("ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON).content(SENSOR_JSON))
                .andExpect(status().isCreated());
    }
}