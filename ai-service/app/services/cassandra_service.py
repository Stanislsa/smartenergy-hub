from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from app.core.config import get_settings
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

QUERY = ("SELECT sensor_id, measured_at, power_kw, voltage, temperature "
         "FROM measurements_by_sensor_day "
         "WHERE sensor_id = ? AND day = ? AND measured_at >= ? AND measured_at < ?")


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
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> List[Dict]:
        """
        Récupère les mesures d'un capteur depuis Cassandra.
        
        Utilise measurements_by_sensor_day avec une requête par jour UTC.
        
        Args:
            sensor_id: Identifiant du capteur
            start: Date de début (optionnel)
            end: Date de fin (optionnel)
        
        Returns:
            Liste des mesures triées chronologiquement
        """
        if not self.is_connected:
            self.connect()
        
        try:
            if start is None:
                start = datetime.now(timezone.utc) - timedelta(days=7)
            if end is None:
                end = datetime.now(timezone.utc)
            
            stmt = self.session.prepare(QUERY)
            rows, day = [], start.date()
            while day <= (end - timedelta(microseconds=1)).date():
                rows.extend(self.session.execute(stmt, (sensor_id, day, start, end)))
                day += timedelta(days=1)
            
            rows.sort(key=lambda r: r.measured_at)
            
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
            raise
    
    def get_latest_measurements(self, sensor_id: str, hours: int = 24) -> List[Dict]:
        """
        Récupère les mesures récentes d'un capteur.
        
        Args:
            sensor_id: Identifiant du capteur
            hours: Nombre d'heures à remonter
        
        Returns:
            Liste des mesures récentes
        """
        start = datetime.now(timezone.utc) - timedelta(hours=hours)
        end = datetime.now(timezone.utc)
        return self.get_measurements_by_sensor(sensor_id, start=start, end=end)
    
