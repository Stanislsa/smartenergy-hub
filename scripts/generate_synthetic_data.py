#!/usr/bin/env python3
"""
Générateur de données synthétiques pour SmartEnergy Hub
Génère des mesures énergétiques réalistes pour les capteurs existants
"""

import random
import argparse
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import json
import requests

# Configuration des capteurs existants (issue de MongoDB)
SENSORS = {
    "SENSOR-001": {
        "name": "Compteur salle serveur",
        "building": "Bâtiment A",
        "maxPowerKw": 8.0,
        "basePowerKw": 3.0,
        "profile": "server"  # Profil stable avec pics occasionnels
    },
    "SENSOR-002": {
        "name": "Compteur atelier",
        "building": "Bâtiment B",
        "maxPowerKw": 12.0,
        "basePowerKw": 5.0,
        "profile": "workshop"  # Profil variable
    },
    "SENSOR-003": {
        "name": "Compteur bureaux",
        "building": "Bâtiment A",
        "maxPowerKw": 5.0,
        "basePowerKw": 2.0,
        "profile": "office"  # Profil horaire (pics en journée)
    }
}

# Types de profils de consommation
PROFILES = {
    "server": {
        "stability": 0.9,  # Très stable
        "peak_probability": 0.05,  # Pics rares
        "peak_multiplier": 1.5,
        "outage_probability": 0.01
    },
    "workshop": {
        "stability": 0.6,  # Variable
        "peak_probability": 0.15,  # Pics fréquents
        "peak_multiplier": 1.8,
        "outage_probability": 0.05
    },
    "office": {
        "stability": 0.7,
        "peak_probability": 0.2,  # Pics en journée
        "peak_multiplier": 2.0,
        "outage_probability": 0.02,
        "hourly_pattern": True  # Pattern horaire (pics 9h-18h)
    }
}

class SyntheticDataGenerator:
    def __init__(self, seed: Optional[int] = None, collector_url: Optional[str] = None):
        """Initialise le générateur avec une graine aléatoire pour la reproductibilité."""
        if seed is not None:
            random.seed(seed)
        self.collector_url = collector_url or "http://localhost:8081/api/measurements"

    def generate_measurement(
        self,
        sensor_id: str,
        timestamp: datetime,
        sensor_config: Dict,
        force_anomaly: Optional[str] = None
    ) -> Dict:
        """
        Génère une mesure énergétique pour un capteur à un instant donné.
        
        Args:
            sensor_id: Identifiant du capteur
            timestamp: Horodatage de la mesure
            sensor_config: Configuration du capteur
            force_anomaly: Type d'anomalie à forcer ('peak', 'outage', 'abnormal')
        
        Returns:
            Dictionnaire représentant la mesure
        """
        profile = PROFILES[sensor_config["profile"]]
        base_power = sensor_config["basePowerKw"]
        max_power = sensor_config["maxPowerKw"]
        
        # Déterminer le type de mesure
        if force_anomaly:
            anomaly_type = force_anomaly
        else:
            rand = random.random()
            if rand < profile.get("outage_probability", 0):
                anomaly_type = "outage"
            elif rand < profile.get("outage_probability", 0) + profile.get("peak_probability", 0):
                anomaly_type = "peak"
            else:
                anomaly_type = "normal"
        
        # Calculer la puissance selon le type
        if anomaly_type == "outage":
            power_kw = random.uniform(0, 0.1)  # Quasi nul
        elif anomaly_type == "peak":
            power_kw = min(base_power * profile.get("peak_multiplier", 1.5), max_power * 1.2)
            # Dépasser maxPowerKw pour créer des anomalies
            if random.random() < 0.3:
                power_kw = max_power * random.uniform(1.1, 1.3)
        elif anomaly_type == "abnormal":
            power_kw = max_power * random.uniform(1.2, 1.5)  # Fort dépassement
        else:  # normal
            # Pattern horaire pour les bureaux
            if profile.get("hourly_pattern") and 9 <= timestamp.hour < 18:
                power_kw = base_power * random.uniform(1.2, 1.5)
            elif profile.get("hourly_pattern") and (timestamp.hour < 6 or timestamp.hour >= 22):
                power_kw = base_power * random.uniform(0.3, 0.5)
            else:
                # Variation normale autour de la base
                variation = (1 - profile.get("stability", 0.8)) * base_power
                power_kw = base_power + random.uniform(-variation, variation)
        
        # S'assurer que la puissance est positive
        power_kw = max(0, power_kw)
        
        # Calculer le courant (P = U * I * sqrt(3) pour triphasé, ou P = U * I pour monophasé)
        # On suppose monophasé pour simplifier : I = P / U
        voltage = random.uniform(220, 240)
        current = (power_kw * 1000) / voltage if voltage > 0 else 0
        
        # Fréquence et température
        frequency = random.uniform(49.9, 50.1)
        temperature = random.uniform(20, 35)
        
        return {
            "sensorId": sensor_id,
            "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
            "powerKw": round(power_kw, 2),
            "voltage": round(voltage, 1),
            "current": round(current, 2),
            "frequency": round(frequency, 2),
            "temperature": round(temperature, 1)
        }

    def generate_sensor_data(
        self,
        sensor_id: str,
        start_date: datetime,
        end_date: datetime,
        interval_minutes: int = 5,
        anomaly_rate: float = 0.05
    ) -> List[Dict]:
        """
        Génère des mesures pour un capteur sur une période.
        
        Args:
            sensor_id: Identifiant du capteur
            start_date: Date de début (incluse)
            end_date: Date de fin (exclue)
            interval_minutes: Intervalle entre les mesures en minutes
            anomaly_rate: Taux d'anomalies (0.0 à 1.0)
        
        Returns:
            Liste des mesures générées
        """
        sensor_config = SENSORS[sensor_id]
        measurements = []
        
        current_time = start_date
        while current_time < end_date:
            # Décider si c'est une anomalie
            if random.random() < anomaly_rate:
                anomaly_types = ["peak", "outage", "abnormal"]
                force_anomaly = random.choice(anomaly_types)
            else:
                force_anomaly = None
            
            measurement = self.generate_measurement(
                sensor_id, current_time, sensor_config, force_anomaly
            )
            measurements.append(measurement)
            
            current_time += timedelta(minutes=interval_minutes)
        
        return measurements

    def send_to_collector(self, measurement: Dict) -> bool:
        """
        Envoie une mesure au Collector Service via l'API.
        
        Args:
            measurement: Mesure à envoyer
        
        Returns:
            True si succès, False sinon
        """
        try:
            response = requests.post(
                self.collector_url,
                json=measurement,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            return response.status_code == 202
        except Exception as e:
            print(f"Erreur lors de l'envoi de la mesure: {e}")
            return False

    def generate_all_sensors(
        self,
        days: int = 10,
        interval_minutes: int = 5,
        anomaly_rate: float = 0.05,
        send_to_api: bool = False,
        output_file: Optional[str] = None
    ) -> Dict[str, List[Dict]]:
        """
        Génère des données pour tous les capteurs.
        
        Args:
            days: Nombre de jours de données à générer
            interval_minutes: Intervalle entre les mesures
            anomaly_rate: Taux d'anomalies
            send_to_api: Si True, envoie les données au Collector
            output_file: Si spécifié, sauvegarde les données dans un fichier JSON
        
        Returns:
            Dictionnaire {sensor_id: [measurements]}
        """
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        all_data = {}
        
        for sensor_id in SENSORS.keys():
            print(f"Génération des données pour {sensor_id}...")
            measurements = self.generate_sensor_data(
                sensor_id, start_date, end_date, interval_minutes, anomaly_rate
            )
            all_data[sensor_id] = measurements
            
            if send_to_api:
                print(f"Envoi de {len(measurements)} mesures pour {sensor_id} au Collector...")
                success_count = 0
                for i, measurement in enumerate(measurements):
                    if self.send_to_collector(measurement):
                        success_count += 1
                    else:
                        print(f"Échec envoi mesure {i+1}/{len(measurements)}")
                    # Petit délai pour éviter de surcharger le service
                    if i % 10 == 0:
                        import time
                        time.sleep(0.1)
                print(f"✓ {success_count}/{len(measurements)} mesures envoyées avec succès")
        
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(all_data, f, indent=2)
            print(f"Données sauvegardées dans {output_file}")
        
        return all_data


def main():
    parser = argparse.ArgumentParser(description="Générateur de données synthétiques SmartEnergy Hub")
    parser.add_argument("--seed", type=int, help="Graine aléatoire pour la reproductibilité")
    parser.add_argument("--days", type=int, default=7, help="Nombre de jours de données (défaut: 7)")
    parser.add_argument("--interval", type=int, default=5, help="Intervalle en minutes (défaut: 5)")
    parser.add_argument("--anomaly-rate", type=float, default=0.05, help="Taux d'anomalies (défaut: 0.05)")
    parser.add_argument("--send", action="store_true", help="Envoyer les données au Collector Service")
    parser.add_argument("--collector-url", type=str, help="URL du Collector Service (défaut: http://localhost:8081/api/measurements)")
    parser.add_argument("--output", type=str, help="Fichier de sortie JSON")
    parser.add_argument("--sensor", type=str, choices=SENSORS.keys(), help="Capteur spécifique (défaut: tous)")
    
    args = parser.parse_args()
    
    generator = SyntheticDataGenerator(seed=args.seed, collector_url=args.collector_url)
    
    if args.sensor:
        # Générer pour un seul capteur
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=args.days)
        measurements = generator.generate_sensor_data(
            args.sensor, start_date, end_date, args.interval, args.anomaly_rate
        )
        
        if args.send:
            print(f"Envoi de {len(measurements)} mesures pour {args.sensor}...")
            for measurement in measurements:
                generator.send_to_collector(measurement)
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump({args.sensor: measurements}, f, indent=2)
            print(f"Données sauvegardées dans {args.output}")
    else:
        # Générer pour tous les capteurs
        generator.generate_all_sensors(
            days=args.days,
            interval_minutes=args.interval,
            anomaly_rate=args.anomaly_rate,
            send_to_api=args.send,
            output_file=args.output
        )


if __name__ == "__main__":
    main()
