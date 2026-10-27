package com.apps.smartenergyhub.collector.service;

import com.apps.smartenergyhub.collector.dto.EnergyMeasurementRequest;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class MeasurementPublisher {

    private static final Logger log = LoggerFactory.getLogger(MeasurementPublisher.class);

    private final StringRedisTemplate redisTemplate;
    private final String streamName;
    private final Counter accepted;
    private final Timer publishTimer;

    public MeasurementPublisher(StringRedisTemplate redisTemplate,
                                @Value("${app.redis.stream}") String streamName,
                                MeterRegistry registry) {
        this.redisTemplate = redisTemplate;
        this.streamName = streamName;
        this.accepted = Counter.builder("energy.measurements")
                .tag("outcome", "accepted")
                .description("Mesures traitées par le Collector, par résultat")
                .register(registry);
        this.publishTimer = Timer.builder("energy.measurements.publish")
                .description("Temps de publication d'une mesure dans Redis")
                .register(registry);
    }

    public RecordId publish(EnergyMeasurementRequest req) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("sensorId", req.sensorId());
        fields.put("timestamp", req.timestamp().toString());
        fields.put("powerKw", String.valueOf(req.powerKw()));
        fields.put("voltage", String.valueOf(req.voltage()));
        // champs facultatifs : absents du message s'ils ne sont pas fournis
        if (req.current() != null)     fields.put("current", String.valueOf(req.current()));
        if (req.frequency() != null)   fields.put("frequency", String.valueOf(req.frequency()));
        if (req.temperature() != null) fields.put("temperature", String.valueOf(req.temperature()));

        RecordId id = publishTimer.record(() -> redisTemplate.opsForStream()
                .add(StreamRecords.string(fields).withStreamKey(streamName)));

        accepted.increment();
        log.info("Mesure publiée : capteur={}, id Redis={}", req.sensorId(), id);
        return id;
    }
}