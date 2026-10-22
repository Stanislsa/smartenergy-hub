package com.apps.smartenergyhub.analytics.service;

import com.apps.smartenergyhub.analytics.dto.SensorRequest;
import com.apps.smartenergyhub.analytics.exception.DuplicateSensorException;
import com.apps.smartenergyhub.analytics.repository.SensorRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SensorServiceTest {

    @Mock
    SensorRepository repository;

    @InjectMocks
    SensorService service;

    @Test
    void create_refuseUnIdentifiantDejaUtilise() {
        when(repository.existsBySensorId("SENSOR-001")).thenReturn(true);
        var req = new SensorRequest("SENSOR-001", "Compteur", "Bâtiment A", 1, 8.0, true, List.of());

        assertThrows(DuplicateSensorException.class, () -> service.create(req));
        verify(repository, never()).save(any());
    }
}