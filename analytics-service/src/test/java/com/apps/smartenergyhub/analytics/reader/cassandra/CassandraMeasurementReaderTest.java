package com.apps.smartenergyhub.analytics.reader.cassandra;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CassandraMeasurementReaderTest {

    private static final String SENSOR = "SENSOR-001";

    @Mock
    private MeasurementRowRepository repository;

    @InjectMocks
    private CassandraMeasurementReader reader;

    private static MeasurementRow row(String instant, Double powerKw) {
        Instant t = Instant.parse(instant);
        return new MeasurementRow(new MeasurementRowKey(SENSOR, LocalDate.parse(instant.substring(0, 10)), t), powerKw);
    }

    @Test
    @DisplayName("Période dans une seule journée : une seule partition (capteur, jour) interrogée")
    void singleDay() {
        Instant from = Instant.parse("2026-10-21T08:00:00Z");
        Instant to = Instant.parse("2026-10-21T09:00:00Z");
        when(repository.findInPartitionBetween(SENSOR, LocalDate.parse("2026-10-21"), from, to))
                .thenReturn(List.of(row("2026-10-21T08:15:00Z", 3.72), row("2026-10-21T08:10:00Z", 3.5)));

        List<MeasurementPoint> points = reader.findBySensorBetween(SENSOR, from, to);

        assertThat(points).extracting(MeasurementPoint::powerKw).containsExactly(3.72, 3.5);
        assertThat(points.get(0).timestamp()).isEqualTo(Instant.parse("2026-10-21T08:15:00Z"));
        verifyNoMoreInteractions(repository);
    }

    @Test
    @DisplayName("Période sur 3 jours : une requête par jour UTC, résultats regroupés")
    void severalDays() {
        Instant from = Instant.parse("2026-10-19T22:00:00Z");
        Instant to = Instant.parse("2026-10-21T02:00:00Z");
        when(repository.findInPartitionBetween(SENSOR, LocalDate.parse("2026-10-19"), from, to))
                .thenReturn(List.of(row("2026-10-19T23:00:00Z", 1.0)));
        when(repository.findInPartitionBetween(SENSOR, LocalDate.parse("2026-10-20"), from, to))
                .thenReturn(List.of(row("2026-10-20T12:00:00Z", 2.0)));
        when(repository.findInPartitionBetween(SENSOR, LocalDate.parse("2026-10-21"), from, to))
                .thenReturn(List.of(row("2026-10-21T01:00:00Z", 3.0)));

        List<MeasurementPoint> points = reader.findBySensorBetween(SENSOR, from, to);

        assertThat(points).extracting(MeasurementPoint::powerKw).containsExactlyInAnyOrder(1.0, 2.0, 3.0);
        verifyNoMoreInteractions(repository);
    }

    @Test
    @DisplayName("'to' à minuit pile (exclu) : le jour suivant n'est pas interrogé")
    void endAtMidnightExcludesNextDay() {
        Instant from = Instant.parse("2026-09-30T00:00:00Z");
        Instant to = Instant.parse("2026-10-01T00:00:00Z");
        when(repository.findInPartitionBetween(SENSOR, LocalDate.parse("2026-09-30"), from, to))
                .thenReturn(List.of());

        assertThat(reader.findBySensorBetween(SENSOR, from, to)).isEmpty();
        verify(repository, never()).findInPartitionBetween(SENSOR, LocalDate.parse("2026-10-01"), from, to);
    }

    @Test
    @DisplayName("Lignes sans puissance ou avec une puissance négative : ignorées")
    void invalidRowsSkipped() {
        Instant from = Instant.parse("2026-10-21T08:00:00Z");
        Instant to = Instant.parse("2026-10-21T09:00:00Z");
        when(repository.findInPartitionBetween(SENSOR, LocalDate.parse("2026-10-21"), from, to))
                .thenReturn(List.of(
                        row("2026-10-21T08:05:00Z", null),
                        row("2026-10-21T08:10:00Z", -1.0),
                        row("2026-10-21T08:15:00Z", 3.72)));

        assertThat(reader.findBySensorBetween(SENSOR, from, to))
                .extracting(MeasurementPoint::powerKw).containsExactly(3.72);
    }

    @Test
    @DisplayName("Période vide (from ≥ to) : aucune requête Cassandra")
    void emptyPeriod() {
        Instant t = Instant.parse("2026-10-21T08:00:00Z");

        assertThat(reader.findBySensorBetween(SENSOR, t, t)).isEmpty();
        verify(repository, never()).findInPartitionBetween(anyString(), any(), any(), any());
    }
}
