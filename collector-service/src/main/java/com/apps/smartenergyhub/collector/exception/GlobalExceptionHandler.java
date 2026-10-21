package com.apps.smartenergyhub.collector.exception;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        List<String> details = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + " : " + e.getDefaultMessage())
                .toList();
        return build(HttpStatus.BAD_REQUEST, "Validation failed", details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        return build(HttpStatus.BAD_REQUEST, "JSON invalide",
                List.of("Corps illisible : vérifiez le format JSON et le timestamp (ex. 2026-09-30T08:15:00Z)"));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleRedis(DataAccessException ex) {
        log.error("Erreur Redis", ex);
        return build(HttpStatus.SERVICE_UNAVAILABLE, "Redis indisponible",
                List.of("La mesure n'a pas pu être publiée, réessayez plus tard"));
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String error, List<String> details) {
        return ResponseEntity.status(status).body(Map.of(
                "status", status.value(),
                "error", error,
                "details", details));
    }
}