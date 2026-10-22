"""
Script pour construire le dataset d'entraînement à partir de Cassandra.
Ce script récupère les mesures historiques et les prépare pour l'entraînement.
"""

import pandas as pd
from datetime import datetime
from typing import Optional
import os


class DatasetBuilder:
    def __init__(self, cassandra_host: str = "localhost", cassandra_port: int = 9042):
        self.cassandra_host = cassandra_host
        self.cassandra_port = cassandra_port
        self.data: Optional[pd.DataFrame] = None
    
    def connect_to_cassandra(self):
        """Connexion à Cassandra (à implémenter avec cassandra-driver)"""
        # TODO: Implémenter la connexion Cassandra
        # from cassandra.cluster import Cluster
        # self.cluster = Cluster([self.cassandra_host], port=self.cassandra_port)
        # self.session = self.cluster.connect('smartenergy')
        pass
    
    def fetch_measurements(self, sensor_id: Optional[str] = None, 
                          start_date: Optional[datetime] = None,
                          end_date: Optional[datetime] = None) -> pd.DataFrame:
        """
        Récupère les mesures de Cassandra.
        
        Args:
            sensor_id: Filtre par capteur (optionnel)
            start_date: Date de début (optionnel)
            end_date: Date de fin (optionnel)
        
        Returns:
            DataFrame avec les mesures
        """
        # TODO: Implémenter la requête CQL
        # query = "SELECT sensor_id, measured_at, power_kw, voltage, temperature FROM measurements_by_sensor_day"
        # rows = self.session.execute(query)
        # self.data = pd.DataFrame(rows)
        
        # Pour l'instant, retourne un DataFrame vide avec les colonnes attendues
        self.data = pd.DataFrame(columns=[
            'sensor_id', 'measured_at', 'power_kw', 'voltage', 'temperature'
        ])
        
        return self.data
    
    def validate_data(self) -> dict:
        """
        Valide la qualité des données.
        
        Returns:
            Dictionnaire avec les statistiques de validation
        """
        if self.data is None or self.data.empty:
            return {"status": "error", "message": "Aucune donnée disponible"}
        
        stats = {
            "total_rows": len(self.data),
            "missing_power": self.data['power_kw'].isna().sum(),
            "missing_voltage": self.data['voltage'].isna().sum(),
            "missing_temperature": self.data['temperature'].isna().sum(),
            "unique_sensors": self.data['sensor_id'].nunique(),
            "date_range": {
                "start": self.data['measured_at'].min(),
                "end": self.data['measured_at'].max()
            }
        }
        
        return stats
    
    def save_dataset(self, output_path: str = "data/raw/dataset.csv"):
        """Sauvegarde le dataset en CSV"""
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        self.data.to_csv(output_path, index=False)
        print(f"Dataset sauvegardé dans {output_path}")


if __name__ == "__main__":
    builder = DatasetBuilder()
    builder.connect_to_cassandra()
    data = builder.fetch_measurements()
    stats = builder.validate_data()
    print("Statistiques de validation:", stats)
    builder.save_dataset()
