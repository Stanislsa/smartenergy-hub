#!/usr/bin/env python3
"""
Energy Data Simulator
Generates simulated energy consumption data for testing
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
        """Generate a single energy reading for a device"""
        return {
            "device_id": device_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "power_kw": round(random.uniform(0.1, 5.0), 2),
            "voltage": round(random.uniform(220, 240), 1),
            "current": round(random.uniform(0.5, 20.0), 2),
            "frequency": round(random.uniform(49.9, 50.1), 2)
        }

    def generate_batch(self, batch_size: int = 100) -> List[Dict]:
        """Generate a batch of energy readings"""
        readings = []
        for _ in range(batch_size):
            device = random.choice(self.devices)
            readings.append(self.generate_reading(device))
        return readings

    def stream_readings(self, interval_seconds: float = 1.0):
        """Stream energy readings continuously"""
        print(f"Starting energy simulator for {self.num_devices} devices...")
        print(f"Streaming readings every {interval_seconds} seconds")
        print("Press Ctrl+C to stop")

        try:
            while True:
                reading = self.generate_reading(random.choice(self.devices))
                print(json.dumps(reading))
                time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\nSimulator stopped")

if __name__ == "__main__":
    simulator = EnergySimulator(num_devices=10)
    simulator.stream_readings(interval_seconds=1.0)
