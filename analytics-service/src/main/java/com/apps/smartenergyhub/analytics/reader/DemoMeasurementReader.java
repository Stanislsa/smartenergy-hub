package com.apps.smartenergyhub.analytics.reader;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Source de mesures <b>de démonstration</b>, active tant que la lecture Cassandra
 * (partie B) n'est pas disponible.
 *
 * <p>Elle reproduit le comportement du simulateur décrit dans le sujet :</p>
 * <ul>
 *   <li>une mesure toutes les 5 minutes ;</li>
 *   <li>une variation jour/nuit en sinus : minimum à minuit (≈ 2 kW), maximum à midi (≈ 5 kW) ;</li>
 *   <li>un petit bruit déterministe (± 0,2 kW) ;</li>
 *   <li>un pic ×3 chaque jour à 14h00 UTC (scénario « anomalie » du sujet).</li>
 * </ul>
 *
 * <p>Les valeurs ne dépendent que de l'horodatage : deux appels identiques renvoient
 * exactement les mêmes mesures, ce qui rend les démonstrations et les tests reproductibles.</p>
 *
 * <p>Activée par défaut, ou explicitement avec {@code analytics.measurement-source=demo}.</p>
 */
@Component
@ConditionalOnProperty(name = "analytics.measurement-source", havingValue = "demo", matchIfMissing = true)
public class DemoMeasurementReader implements MeasurementReader {

    static final Duration STEP = Duration.ofMinutes(5);
    static final double BASE_KW = 3.5;
    static final double AMPLITUDE_KW = 1.5;
    static final double NOISE_KW = 0.2;
    static final double SPIKE_FACTOR = 3.0;
    static final LocalTime SPIKE_TIME = LocalTime.of(14, 0);

    private static final long SECONDS_PER_DAY = 86_400L;

    @Override
    public List<MeasurementPoint> findBySensorBetween(String sensorId, Instant from, Instant to) {
        long step = STEP.getSeconds();
        long first = Math.floorDiv(from.getEpochSecond(), step) * step;
        if (Instant.ofEpochSecond(first).isBefore(from)) {
            first += step;
        }

        List<MeasurementPoint> points = new ArrayList<>();
        for (long t = first; Instant.ofEpochSecond(t).isBefore(to); t += step) {
            points.add(new MeasurementPoint(Instant.ofEpochSecond(t), powerAt(t)));
        }
        return points;
    }

    /** Puissance simulée (kW) à un instant donné, arrondie au watt. */
    static double powerAt(long epochSecond) {
        long secondOfDay = Math.floorMod(epochSecond, SECONDS_PER_DAY);
        double hour = secondOfDay / 3600.0;
        double power = BASE_KW
                + AMPLITUDE_KW * Math.sin(2 * Math.PI * hour / 24 - Math.PI / 2)
                + noise(epochSecond);
        if (secondOfDay == SPIKE_TIME.toSecondOfDay()) {
            power *= SPIKE_FACTOR;
        }
        return Math.max(0.0, Math.round(power * 1000) / 1000.0);
    }

    /** Bruit pseudo-aléatoire déterministe dans [−NOISE_KW ; +NOISE_KW]. */
    private static double noise(long epochSecond) {
        long h = (epochSecond / STEP.getSeconds()) * 2_654_435_761L;
        h ^= (h >>> 16);
        double u = Math.floorMod(h, 1000L) / 999.0;
        return (2 * u - 1) * NOISE_KW;
    }
}
