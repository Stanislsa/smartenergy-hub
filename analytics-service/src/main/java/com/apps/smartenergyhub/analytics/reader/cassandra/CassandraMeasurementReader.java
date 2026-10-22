package com.apps.smartenergyhub.analytics.reader.cassandra;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import com.apps.smartenergyhub.analytics.reader.MeasurementReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Lecture des mesures réelles dans Cassandra (table {@code measurements_by_sensor_day}).
 *
 * <p>La table est partitionnée par (capteur, jour UTC). Pour une période [from ; to[,
 * le lecteur interroge donc chaque jour UTC couvert par la période, une partition à la fois.
 * La période étant limitée à 31 jours par {@code AnalyticsService}, cela fait au plus 32 requêtes.</p>
 *
 * <p>Les lignes sans puissance ou avec une puissance invalide (négative, NaN) sont ignorées
 * et signalées dans les logs : elles ne doivent pas fausser les calculs. La tension et la
 * température sont facultatives : une valeur absente ou invalide est remplacée par {@code null}
 * (la mesure est gardée, seules les détections de tension/température l'ignorent).</p>
 *
 * <p>Activé avec {@code analytics.measurement-source=cassandra}.</p>
 */
@Component
@ConditionalOnProperty(name = "analytics.measurement-source", havingValue = "cassandra")
public class CassandraMeasurementReader implements MeasurementReader {

    private static final Logger log = LoggerFactory.getLogger(CassandraMeasurementReader.class);

    private final MeasurementRowRepository repository;

    public CassandraMeasurementReader(MeasurementRowRepository repository) {
        this.repository = repository;
    }

    @Override
    public List<MeasurementPoint> findBySensorBetween(String sensorId, Instant from, Instant to) {
        List<MeasurementPoint> points = new ArrayList<>();
        if (!from.isBefore(to)) {
            return points;
        }

        LocalDate firstDay = LocalDate.ofInstant(from, ZoneOffset.UTC);
        LocalDate lastDay = LocalDate.ofInstant(to.minusNanos(1), ZoneOffset.UTC);
        int skipped = 0;

        for (LocalDate day = firstDay; !day.isAfter(lastDay); day = day.plusDays(1)) {
            for (MeasurementRow row : repository.findInPartitionBetween(sensorId, day, from, to)) {
                Double power = row.getPowerKw();
                Instant measuredAt = row.getKey() == null ? null : row.getKey().getMeasuredAt();
                if (measuredAt == null || power == null || !Double.isFinite(power) || power < 0) {
                    skipped++;
                    continue;
                }
                points.add(new MeasurementPoint(measuredAt, power,
                        validVoltage(row.getVoltage()), validTemperature(row.getTemperature())));
            }
        }

        if (skipped > 0) {
            log.warn("{} mesure(s) invalide(s) ignorée(s) pour {} entre {} et {}", skipped, sensorId, from, to);
        }
        return points;
    }

    /** Tension facultative : {@code null} si absente, négative ou non finie. */
    static Double validVoltage(Double voltage) {
        return (voltage != null && Double.isFinite(voltage) && voltage >= 0) ? voltage : null;
    }

    /** Température facultative : {@code null} si absente ou non finie. */
    static Double validTemperature(Double temperature) {
        return (temperature != null && Double.isFinite(temperature)) ? temperature : null;
    }
}
