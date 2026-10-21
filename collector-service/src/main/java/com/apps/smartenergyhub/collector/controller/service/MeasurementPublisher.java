package com.apps.smartenergyhub.collector.service;

import com.apps.smartenergyhub.collector.dto.EnergyMeasurementRequest;
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

    public MeasurementPublisher(StringRedisTemplate redisTemplate,
                                @Value("${app.redis.stream}") String streamName) {
        this.redisTemplate = redisTemplate;
        this.streamName = streamName;
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

        RecordId id = redisTemplate.opsForStream()
                .add(StreamRecords.string(fields).withStreamKey(streamName));

        log.info("Mesure publiée : capteur={}, id Redis={}", req.sensorId(), id);
        return id;
    }
}