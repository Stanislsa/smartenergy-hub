#!/usr/bin/env python3
"""
Simulateur de Données Énergétiques
Génère des données de consommation énergétique simulées pour les tests
"""

import random
import time
import json
from datetime import datetime
from typing import Dict, List

class EnergySimulator:
    def __init__(self, num_devices: int = 10):
        self.num_devices = num_devices
        self.devices = [f"device_{i}" for i in range(1, num_devices + 1)]

    def generate_reading(self, device_id: str) -> Dict:
        """Génère une seule lecture énergétique pour un appareil"""
        return {
            "device_id": device_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "power_kw": round(random.uniform(0.1, 5.0), 2),
            "voltage": round(random.uniform(220, 240), 1),
            "current": round(random.uniform(0.5, 20.0), 2),
            "frequency": round(random.uniform(49.9, 50.1), 2)
        }

    def generate_batch(self, batch_size: int = 100) -> List[Dict]:
        """Génère un lot de lectures énergétiques"""
        readings = []
        for _ in range(batch_size):
            device = random.choice(self.devices)
            readings.append(self.generate_reading(device))
        return readings

    def stream_readings(self, interval_seconds: float = 1.0):
        """Diffuse en continu des lectures énergétiques"""
        print(f"Démarrage du simulateur énergétique pour {self.num_devices} appareils...")
        print(f"Diffusion des lectures toutes les {interval_seconds} secondes")
        print("Appuyez sur Ctrl+C pour arrêter")

        try:
            while True:
                reading = self.generate_reading(random.choice(self.devices))
                print(json.dumps(reading))
                time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\nSimulateur arrêté")

if __name__ == "__main__":
    simulator = EnergySimulator(num_devices=10)
    simulator.stream_readings(interval_seconds=1.0)
