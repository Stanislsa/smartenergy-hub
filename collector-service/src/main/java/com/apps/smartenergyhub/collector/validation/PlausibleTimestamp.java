package com.apps.smartenergyhub.collector.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Vérifie qu'un horodatage est plausible : ni trop loin dans le futur (horloge du capteur déréglée),
 * ni absurdement ancien (donnée corrompue). Une valeur absente est ignorée : c'est @NotNull qui la signale.
 */
@Documented
@Constraint(validatedBy = PlausibleTimestampValidator.class)
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface PlausibleTimestamp {

    String message() default "doit être comprise entre {maxAgeDays} jours dans le passé et {maxFutureSeconds} secondes dans le futur";

    /** Avance maximale tolérée sur l'horloge du serveur, en secondes. */
    long maxFutureSeconds() default 300;

    /** Ancienneté maximale acceptée, en jours (rattrapage d'un capteur resté hors ligne). */
    long maxAgeDays() default 365;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}