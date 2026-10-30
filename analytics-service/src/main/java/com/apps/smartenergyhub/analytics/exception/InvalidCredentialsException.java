package com.apps.smartenergyhub.analytics.exception;

public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Identifiant ou mot de passe incorrect");
    }
}
