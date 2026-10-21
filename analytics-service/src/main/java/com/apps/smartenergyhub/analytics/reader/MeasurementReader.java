package com.apps.smartenergyhub.analytics.reader;

import com.apps.smartenergyhub.analytics.model.MeasurementPoint;

import java.time.Instant;
import java.util.List;

/**
 * Source des mesures lues par le module Analytics.
 *
 * <p>Le module Analytics ne fait que lire : il ne sait pas d'où viennent les mesures.
 * Aujourd'hui, l'implémentation active est {@link DemoMeasurementReader} (données simulées).
 * Lorsque la table Cassandra de la partie B sera finalisée, il suffira d'ajouter une
 * implémentation {@code CassandraMeasurementReader} activée par
 * {@code analytics.measurement-source=cassandra}, sans modifier le service ni le contrôleur.</p>
 */
public interface MeasurementReader {

    /**
     * Renvoie les mesures d'un capteur dont l'horodatage est dans [from ; to[.
     *
     * @param sensorId identifiant métier du capteur (ex. "SENSOR-001")
     * @param from     début de période, inclus
     * @param to       fin de période, exclue
     * @return mesures dans un ordre quelconque (les calculs trient eux-mêmes)
     */
    List<MeasurementPoint> findBySensorBetween(String sensorId, Instant from, Instant to);
}
