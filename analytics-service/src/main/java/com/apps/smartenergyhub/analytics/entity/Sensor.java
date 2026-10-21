package com.apps.smartenergyhub.analytics.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "sensors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sensor {

    @Id
    private String id;                 // identifiant technique MongoDB (_id)

    @Indexed(unique = true)
    private String sensorId;           // identifiant métier : "SENSOR-001"

    private String name;
    private String building;
    private Integer floor;
    private Double maxPowerKw;
    private boolean active;
    private List<String> tags;
    private Instant createdAt;
    private Instant updatedAt;
}