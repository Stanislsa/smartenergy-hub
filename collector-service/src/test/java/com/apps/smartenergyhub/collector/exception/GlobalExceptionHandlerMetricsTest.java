package com.apps.smartenergyhub.collector.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.apps.smartenergyhub.collector.controller.MeasurementController;
import com.apps.smartenergyhub.collector.service.MeasurementPublisher;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class GlobalExceptionHandlerMetricsTest {

    private static final String VALID_JSON =
            "{\"sensorId\":\"SENSOR-001\",\"timestamp\":\"2026-09-30T08:15:00Z\",\"powerKw\":3.72,\"voltage\":226.4}";

    private SimpleMeterRegistry registry;
    private MeasurementPublisher publisher;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        publisher = Mockito.mock(MeasurementPublisher.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new MeasurementController(publisher))
                .setControllerAdvice(new GlobalExceptionHandler(registry))
                .build();
    }

    private double count(String outcome) {
        Counter c = registry.find("energy.measurements").tag("outcome", outcome).counter();
        return c == null ? 0.0 : c.count();
    }

    @Test
    void mesureInvalideIncrementeRejectedValidation() throws Exception {
        String sansSensorId = "{\"timestamp\":\"2026-09-30T08:15:00Z\",\"powerKw\":3.72,\"voltage\":226.4}";

        mockMvc.perform(post("/api/measurements")
                        .contentType(MediaType.APPLICATION_JSON).content(sansSensorId))
                .andExpect(status().isBadRequest());

        assertThat(count("rejected_validation")).isEqualTo(1.0);
        assertThat(count("rejected_format")).isZero();
    }

    @Test
    void jsonIllisibleIncrementeRejectedFormat() throws Exception {
        mockMvc.perform(post("/api/measurements")
                        .contentType(MediaType.APPLICATION_JSON).content("ceci n'est pas du json"))
                .andExpect(status().isBadRequest());

        assertThat(count("rejected_format")).isEqualTo(1.0);
        assertThat(count("rejected_validation")).isZero();
    }

    @Test
    void redisIndisponibleIncrementeErrorRedis() throws Exception {
        doThrow(new QueryTimeoutException("redis indisponible")).when(publisher).publish(any());

        mockMvc.perform(post("/api/measurements")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_JSON))
                .andExpect(status().isServiceUnavailable());

        assertThat(count("error_redis")).isEqualTo(1.0);
    }
}