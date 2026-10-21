package com.apps.smartenergyhub.storage.consumer;

import com.apps.smartenergyhub.storage.service.CassandraMeasurementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

/**
 * Consommateur Redis Streams pour le storage-service.
 * Lit les mesures du flux Redis et les persiste dans Cassandra.
 * 
 * Ordre de traitement :
 * 1. Lire le message Redis
 * 2. Valider et convertir la mesure
 * 3. Enregistrer dans Cassandra
 * 4. Vérifier que l'écriture a réussi
 * 5. Acquitter le message Redis (ACK)
 */
@Component
public class RedisStreamConsumer {

    private static final Logger log = LoggerFactory.getLogger(RedisStreamConsumer.class);

    private final StringRedisTemplate redisTemplate;
    private final CassandraMeasurementService cassandraMeasurementService;
    private final String streamName;
    private final String consumerGroup;
    private final String consumerName;

    public RedisStreamConsumer(StringRedisTemplate redisTemplate,
                               CassandraMeasurementService cassandraMeasurementService,
                               @Value("${app.redis.stream}") String streamName,
                               @Value("${app.redis.consumer-group}") String consumerGroup,
                               @Value("${app.redis.consumer-name}") String consumerName) {
        this.redisTemplate = redisTemplate;
        this.cassandraMeasurementService = cassandraMeasurementService;
        this.streamName = streamName;
        this.consumerGroup = consumerGroup;
        this.consumerName = consumerName;
        
        initializeConsumerGroup();
    }

    /**
     * Initialise le consumer group Redis Streams s'il n'existe pas.
     */
    private void initializeConsumerGroup() {
        try {
            redisTemplate.opsForStream().createGroup(streamName, consumerGroup);
            log.info("Consumer group créé : {} pour le flux {}", consumerGroup, streamName);
        } catch (Exception e) {
            // Le groupe existe déjà, ce n'est pas une erreur
            log.info("Consumer group {} existe déjà pour le flux {}", consumerGroup, streamName);
        }
    }

    /**
     * Traite les messages du flux Redis de manière planifiée.
     * Cette méthode est appelée périodiquement pour lire les nouveaux messages.
     */
    @Scheduled(fixedDelay = 1000) // Vérifie toutes les secondes
    public void consumeMessages() {
        try {
            // Lire les messages non acquittés pour ce consommateur
            var messages = redisTemplate.opsForStream()
                    .read(Consumer.from(consumerGroup, consumerName),
                          StreamOffset.create(streamName, ReadOffset.lastConsumed()));

            if (messages != null && !messages.isEmpty()) {
                for (MapRecord<String, Object, Object> message : messages) {
                    processMessage(message);
                }
            }
        } catch (Exception e) {
            log.error("Erreur lors de la consommation des messages Redis", e);
            // Ne pas arrêter le consommateur, il réessayera au prochain cycle
        }
    }

    /**
     * Traite un message individuel.
     * Ordre : validation -> persistance Cassandra -> ACK Redis
     */
    private void processMessage(MapRecord<String, Object, Object> message) {
        RecordId messageId = message.getId();
        Map<Object, Object> fields = message.getValue();

        try {
            log.debug("Traitement du message Redis : {}", messageId);

            // 1. Valider et convertir la mesure
            EnergyMeasurement measurement = parseMeasurement(fields);

            // 2. Enregistrer dans Cassandra
            cassandraMeasurementService.saveMeasurement(
                measurement.sensorId(),
                measurement.timestamp(),
                measurement.powerKw(),
                measurement.voltage(),
                measurement.current(),
                measurement.frequency(),
                measurement.temperature()
            );

            log.info("Mesure persistée dans Cassandra : capteur={}, timestamp={}", 
                    measurement.sensorId(), measurement.timestamp());

            // 3. Acquitter le message Redis uniquement après persistance réussie
            redisTemplate.opsForStream().acknowledge(streamName, consumerGroup, messageId);
            log.debug("Message Redis acquitté : {}", messageId);

        } catch (Exception e) {
            log.error("Erreur lors du traitement du message {}, ne sera pas acquitté et sera retraité", messageId, e);
            // Ne pas acquitter le message en cas d'erreur
            // Il sera retraité au prochain cycle
        }
    }

    /**
     * Convertit les champs du message Redis en objet EnergyMeasurement.
     */
    private EnergyMeasurement parseMeasurement(Map<Object, Object> fields) {
        String sensorId = getRequiredField(fields, "sensorId");
        Instant timestamp = Instant.parse(getRequiredField(fields, "timestamp"));
        double powerKw = Double.parseDouble(getRequiredField(fields, "powerKw"));
        double voltage = Double.parseDouble(getRequiredField(fields, "voltage"));
        
        Double current = parseOptionalDouble(fields, "current");
        Double frequency = parseOptionalDouble(fields, "frequency");
        Double temperature = parseOptionalDouble(fields, "temperature");

        return new EnergyMeasurement(sensorId, timestamp, powerKw, voltage, current, frequency, temperature);
    }

    private String getRequiredField(Map<Object, Object> fields, String key) {
        Object value = fields.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Champ obligatoire manquant : " + key);
        }
        return value.toString();
    }

    private Double parseOptionalDouble(Map<Object, Object> fields, String key) {
        Object value = fields.get(key);
        if (value == null || value.toString().isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            log.warn("Impossible de parser le champ {} comme Double : {}", key, value);
            return null;
        }
    }

    /**
     * Record pour représenter une mesure énergétique.
     */
    private record EnergyMeasurement(
            String sensorId,
            Instant timestamp,
            double powerKw,
            double voltage,
            Double current,
            Double frequency,
            Double temperature
    ) {}
}
