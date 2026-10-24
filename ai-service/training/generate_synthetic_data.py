"""
Générateur de données synthétiques pour l'entraînement des modèles.
Crée un dataset avec le format: sensor_id, measured_at (UTC, horaire), power_kw, voltage, temperature, is_anomaly, anomaly_type
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os


def generate_synthetic_measurements(
    output_path: str = "data/raw/dataset.csv",
    num_sensors: int = 5,
    days: int = 30,
    start_date: datetime = None
):
    """
    Génère des mesures synthétiques horaires pour l'entraînement.
    
    Args:
        output_path: Chemin de sortie du CSV
        num_sensors: Nombre de capteurs à simuler
        days: Nombre de jours de données
        start_date: Date de début (défaut: 30 jours avant maintenant)
    """
    if start_date is None:
        start_date = datetime.now(tz=None) - timedelta(days=days)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    all_data = []
    
    for sensor_id in range(1, num_sensors + 1):
        sensor_name = f"sensor_{sensor_id:03d}"
        
        # Profil de consommation de base (varie par capteur)
        base_power = 3.0 + np.random.uniform(-1.0, 2.0)
        
        # Génération horaire
        current_time = start_date
        for hour in range(days * 24):
            # Pattern journalier: pic le matin et le soir
            hour_of_day = current_time.hour
            daily_pattern = 1.0 + 0.5 * np.sin(2 * np.pi * (hour_of_day - 6) / 24)
            
            # Pattern hebdomadaire: moins le weekend
            day_of_week = current_time.weekday()
            weekend_factor = 0.7 if day_of_week >= 5 else 1.0
            
            # Bruit aléatoire
            noise = np.random.normal(0, 0.3)
            
            # Calcul de la puissance
            power_kw = base_power * daily_pattern * weekend_factor + noise
            power_kw = max(0.5, power_kw)  # Minimum 0.5 kW
            
            # Voltage (normalement 230V +/- 10%)
            voltage = 230 + np.random.normal(0, 5)
            
            # Température (varie avec l'heure et le jour)
            temp_base = 20 + 10 * np.sin(2 * np.pi * (hour_of_day - 14) / 24)
            temperature = temp_base + np.random.normal(0, 2)
            
            # Détection d'anomalies (5% des mesures)
            is_anomaly = np.random.random() < 0.05
            anomaly_type = None
            
            if is_anomaly:
                anomaly_type = np.random.choice([
                    "spike_power",
                    "voltage_drop",
                    "overload",
                    "unusual_pattern"
                ], p=[0.4, 0.3, 0.2, 0.1])
                
                # Appliquer l'anomalie
                if anomaly_type == "spike_power":
                    power_kw *= np.random.uniform(2.0, 4.0)
                elif anomaly_type == "voltage_drop":
                    voltage *= np.random.uniform(0.7, 0.9)
                elif anomaly_type == "overload":
                    power_kw *= np.random.uniform(1.5, 2.0)
            
            all_data.append({
                "sensor_id": sensor_name,
                "measured_at": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                "power_kw": round(power_kw, 3),
                "voltage": round(voltage, 1),
                "temperature": round(temperature, 1),
                "is_anomaly": is_anomaly,
                "anomaly_type": anomaly_type
            })
            
            current_time += timedelta(hours=1)
    
    # Créer le DataFrame
    df = pd.DataFrame(all_data)
    
    # Sauvegarder
    df.to_csv(output_path, index=False)
    print(f"Données synthétiques générées: {len(df)} lignes")
    print(f"Fichier sauvegardé: {output_path}")
    print(f"Capteurs: {num_sensors}, Période: {days} jours")
    print(f"Taux d'anomalies: {df['is_anomaly'].mean():.2%}")
    
    return df


if __name__ == "__main__":
    print("=== Génération de données synthétiques ===")
    generate_synthetic_measurements(
        output_path="data/raw/dataset.csv",
        num_sensors=5,
        days=30
    )
