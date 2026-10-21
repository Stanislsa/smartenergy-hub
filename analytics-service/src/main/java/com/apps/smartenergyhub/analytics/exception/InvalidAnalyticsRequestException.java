package com.apps.smartenergyhub.analytics.exception;

/**
 * Paramètres invalides pour une requête Analytics (période incohérente, seuil z invalide).
 * Traduite en HTTP 400 par {@code AnalyticsController}.
 */
public class InvalidAnalyticsRequestException extends RuntimeException {

    public InvalidAnalyticsRequestException(String message) {
        super(message);
    }
}
