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
import org.springframework.data.redis.connection.stream.StreamReadOptions;
import java.time.DateTimeException;

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

    /** Taille maximale d'un lot lu dans Redis ; le flux est vidé lot par lot à chaque cycle. */
    private static final int BATCH_SIZE = 100;

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
     * Les messages en attente sont relus d'abord, puis le flux est vidé lot par lot
     * avant d'attendre le cycle suivant (sinon le débit serait plafonné à un lot par cycle).
     */
    @Scheduled(fixedDelay = 1000) // Vérifie toutes les secondes
    public void consumeMessages() {
        try {
            // 1. D'abord les messages déjà lus par ce consumer mais jamais acquittés
            processBatch(ReadOffset.from("0"));
            // 2. Ensuite les nouveaux messages : on vide le flux avant d'attendre le cycle suivant
            int lus;
            do {
                lus = processBatch(ReadOffset.lastConsumed());
            } while (lus >= BATCH_SIZE);
        } catch (Exception e) {
            log.error("Erreur lors de la consommation des messages Redis", e);
            // Ne pas arrêter le consommateur, il réessayera au prochain cycle
        }
    }

    private int processBatch(ReadOffset offset) {
        var messages = redisTemplate.opsForStream()
                .read(Consumer.from(consumerGroup, consumerName),
                      StreamReadOptions.empty().count(BATCH_SIZE),
                      StreamOffset.create(streamName, offset));

        if (messages == null || messages.isEmpty()) {
            return 0;
        }
        for (MapRecord<String, Object, Object> message : messages) {
            processMessage(message);
        }
        return messages.size();
    }

    /**
     * Traite un message individuel.
     * Ordre : validation -> persistance Cassandra -> ACK Redis
     */
    private void processMessage(MapRecord<String, Object, Object> message) {
        RecordId messageId = message.getId();
        Map<Object, Object> fields = message.getValue();

        // Message invalide : inutile de le retenter, on l'écarte (acquitté) en gardant une trace
        EnergyMeasurement measurement;
        try {
            measurement = parseMeasurement(fields);
        } catch (IllegalArgumentException | DateTimeException e) {
            log.error("Message {} invalide, écarté définitivement : {}", messageId, e.getMessage());
            redisTemplate.opsForStream().acknowledge(streamName, consumerGroup, messageId);
            return;
        }

        try {
            log.debug("Traitement du message Redis : {}", messageId);

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

            // Acquitter uniquement après persistance réussie
            redisTemplate.opsForStream().acknowledge(streamName, consumerGroup, messageId);
            log.debug("Message Redis acquitté : {}", messageId);

        } catch (Exception e) {
            // Panne temporaire (Cassandra...) : pas d'ACK, le message sera relu au prochain cycle
            log.error("Erreur lors du traitement du message {}, non acquitté, il sera relu", messageId, e);
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