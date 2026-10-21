package com.apps.smartenergyhub.analytics.exception;

public class DuplicateSensorException extends RuntimeException {

    public DuplicateSensorException(String sensorId) {
        super("Un capteur avec l'identifiant " + sensorId + " existe déjà");
    }
}