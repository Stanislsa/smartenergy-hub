package com.apps.smartenergyhub.collector.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public class PlausibleTimestampValidator implements ConstraintValidator<PlausibleTimestamp, Instant> {

    private long maxFutureSeconds;
    private long maxAgeDays;

    @Override
    public void initialize(PlausibleTimestamp constraint) {
        this.maxFutureSeconds = constraint.maxFutureSeconds();
        this.maxAgeDays = constraint.maxAgeDays();
    }

    @Override
    public boolean isValid(Instant value, ConstraintValidatorContext context) {
        if (value == null) {
            return true; // l'absence est signalée par @NotNull
        }
        Instant now = Instant.now();
        Instant latest = now.plusSeconds(maxFutureSeconds);
        Instant earliest = now.minus(maxAgeDays, ChronoUnit.DAYS);
        return !value.isAfter(latest) && !value.isBefore(earliest);
    }
}