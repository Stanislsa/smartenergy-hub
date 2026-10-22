from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from app.core.config import get_settings
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CassandraService:
    def __init__(self):
        self.settings = get_settings()
        self.cluster = None
        self.session = None
        self.is_connected = False
    
    def connect(self):
        """Établit la connexion à Cassandra"""
        try:
            if self.settings.cassandra_username and self.settings.cassandra_password:
                auth_provider = PlainTextAuthProvider(
                    username=self.settings.cassandra_username,
                    password=self.settings.cassandra_password
                )
                self.cluster = Cluster(
                    [self.settings.cassandra_host],
                    port=self.settings.cassandra_port,
                    auth_provider=auth_provider
                )
            else:
                self.cluster = Cluster(
                    [self.settings.cassandra_host],
                    port=self.settings.cassandra_port
                )
            
            self.session = self.cluster.connect()
            self.session.set_keyspace(self.settings.cassandra_keyspace)
            self.is_connected = True
            logger.info(f"Connecté à Cassandra: {self.settings.cassandra_host}:{self.settings.cassandra_port}")
        except Exception as e:
            logger.error(f"Erreur de connexion Cassandra: {e}")
            self.is_connected = False
    
    def disconnect(self):
        """Ferme la connexion Cassandra"""
        if self.session:
            self.session.shutdown()
        if self.cluster:
            self.cluster.shutdown()
        self.is_connected = False
        logger.info("Connexion Cassandra fermée")
    
    def get_measurements_by_sensor(
        self,
        sensor_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 10000
    ) -> List[Dict]:
        """
        Récupère les mesures d'un capteur depuis Cassandra.
        
        Args:
            sensor_id: Identifiant du capteur
            start_date: Date de début (optionnel)
            end_date: Date de fin (optionnel)
            limit: Nombre maximum de résultats
        
        Returns:
            Liste des mesures
        """
        if not self.is_connected:
            self.connect()
        
        try:
            query = f"""
                SELECT sensor_id, measured_at, power_kw, voltage, temperature
                FROM measurements
                WHERE sensor_id = %s
            """
            
            params = [sensor_id]
            
            if start_date:
                query += " AND measured_at >= %s"
                params.append(start_date)
            
            if end_date:
                query += " AND measured_at <= %s"
                params.append(end_date)
            
            query += " ORDER BY measured_at DESC"
            query += f" LIMIT {limit}"
            
            statement = self.session.prepare(query)
            rows = self.session.execute(statement, params)
            
            measurements = []
            for row in rows:
                measurements.append({
                    "sensor_id": row.sensor_id,
                    "measured_at": row.measured_at,
                    "power_kw": row.power_kw,
                    "voltage": row.voltage if hasattr(row, 'voltage') else None,
                    "temperature": row.temperature if hasattr(row, 'temperature') else None
                })
            
            logger.info(f"Récupéré {len(measurements)} mesures pour {sensor_id}")
            return measurements
        
        except Exception as e:
            logger.error(f"Erreur récupération mesures: {e}")
            return []
    
    def get_latest_measurements(self, sensor_id: str, hours: int = 24) -> List[Dict]:
        """
        Récupère les mesures récentes d'un capteur.
        
        Args:
            sensor_id: Identifiant du capteur
            hours: Nombre d'heures à remonter
        
        Returns:
            Liste des mesures récentes
        """
        start_date = datetime.utcnow() - timedelta(hours=hours)
        return self.get_measurements_by_sensor(sensor_id, start_date=start_date)
    
    def get_aggregated_consumption(
        self,
        sensor_id: str,
        period_hours: int = 24
    ) -> Dict:
        """
        Récupère la consommation agrégée sur une période.
        
        Args:
            sensor_id: Identifiant du capteur
            period_hours: Période en heures
        
        Returns:
            Dictionnaire avec statistiques agrégées
        """
        measurements = self.get_latest_measurements(sensor_id, period_hours)
        
        if not measurements:
            return {
                "sensor_id": sensor_id,
                "period_hours": period_hours,
                "count": 0,
                "avg_power_kw": 0,
                "max_power_kw": 0,
                "min_power_kw": 0,
                "total_energy_kwh": 0
            }
        
        power_values = [m["power_kw"] for m in measurements]
        
        return {
            "sensor_id": sensor_id,
            "period_hours": period_hours,
            "count": len(measurements),
            "avg_power_kw": sum(power_values) / len(power_values),
            "max_power_kw": max(power_values),
            "min_power_kw": min(power_values),
            "total_energy_kwh": sum(power_values) * period_hours  # Approximation
        }
