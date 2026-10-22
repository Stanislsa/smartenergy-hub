"""
Service pour la gestion des données (Cassandra, cache, etc.)
"""

from typing import Optional
import pandas as pd


class DataService:
    """Service pour récupérer et gérer les données de mesure"""
    
    def __init__(self):
        # TODO: Initialiser la connexion Cassandra
        pass
    
    def get_measurements_by_sensor(
        self, 
        sensor_id: str, 
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Récupère les mesures d'un capteur sur une période.
        
        Args:
            sensor_id: Identifiant du capteur
            start_date: Date de début (optionnel)
            end_date: Date de fin (optionnel)
        
        Returns:
            DataFrame avec les mesures
        """
        # TODO: Implémenter la requête Cassandra
        return pd.DataFrame()
    
    def get_latest_measurements(self, sensor_id: str, limit: int = 100) -> pd.DataFrame:
        """
        Récupère les N dernières mesures d'un capteur.
        
        Args:
            sensor_id: Identifiant du capteur
            limit: Nombre de mesures à récupérer
        
        Returns:
            DataFrame avec les mesures
        """
        # TODO: Implémenter la requête Cassandra
        return pd.DataFrame()
