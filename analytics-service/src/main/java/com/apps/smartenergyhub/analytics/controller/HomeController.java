package com.apps.smartenergyhub.analytics.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "Analytics Service is running!";
    }

    @GetMapping("/health")
    public String health() {
        return "OK";
    }
}
