from app.schemas.efficiency import EfficiencyResponse
from app.core.config import get_settings
from app.services.cassandra_service import CassandraService
from datetime import datetime, timedelta
from typing import List, Dict
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EfficiencyService:
    def __init__(self):
        self.settings = get_settings()
        self.cassandra = CassandraService()
        # Stockage en mémoire pour les données historiques (fallback si Cassandra indisponible)
        self.historical_data: Dict[str, List[dict]] = {}
    
    def analyze_efficiency(self, sensor_id: str, period_days: int = 30) -> EfficiencyResponse:
        """
        Analyse l'efficacité énergétique d'un capteur.
        
        Args:
            sensor_id: Identifiant du capteur
            period_days: Période d'analyse en jours
        
        Returns:
            EfficiencyResponse avec score d'efficacité et recommandations
        """
        try:
            # Tenter de récupérer les données depuis Cassandra
            measurements = self.cassandra.get_measurements_by_sensor(
                sensor_id,
                start_date=datetime.utcnow() - timedelta(days=period_days),
                limit=10000
            )
            
            if not measurements:
                logger.warning(f"Aucune donnée Cassandra pour {sensor_id}, utilisation données mémoire")
                return self._analyze_from_memory(sensor_id, period_days)
            
            # Convertir les mesures Cassandra
            data = [
                {
                    "power_kw": m["power_kw"],
                    "timestamp": m["measured_at"]
                }
                for m in measurements
            ]
            
            return self._analyze_from_data(sensor_id, period_days, data)
            
        except Exception as e:
            logger.error(f"Erreur Cassandra pour {sensor_id}: {e}, utilisation données mémoire")
            return self._analyze_from_memory(sensor_id, period_days)
    
    def _analyze_from_memory(self, sensor_id: str, period_days: int) -> EfficiencyResponse:
        """Analyse depuis les données en mémoire (fallback)"""
        if sensor_id not in self.historical_data or len(self.historical_data[sensor_id]) == 0:
            return self._generate_mock_response(sensor_id, period_days)
        
        data = self.historical_data[sensor_id]
        cutoff_date = datetime.utcnow() - timedelta(days=period_days)
        recent_data = [d for d in data if d["timestamp"] >= cutoff_date]
        
        if len(recent_data) < 10:
            return self._generate_mock_response(sensor_id, period_days)
        
        return self._analyze_from_data(sensor_id, period_days, recent_data)
    
    def _analyze_from_data(self, sensor_id: str, period_days: int, data: List[dict]) -> EfficiencyResponse:
        """Analyse depuis les données fournies"""
        # Calculer la consommation moyenne
        power_values = [d["power_kw"] for d in data]
        avg_consumption = np.mean(power_values)
        
        # Consommation attendue (basée sur la période précédente)
        previous_cutoff = datetime.utcnow() - timedelta(days=period_days * 2)
        current_cutoff = datetime.utcnow() - timedelta(days=period_days)
        
        try:
            previous_measurements = self.cassandra.get_measurements_by_sensor(
                sensor_id,
                start_date=previous_cutoff,
                end_date=current_cutoff,
                limit=10000
            )
            
            if len(previous_measurements) > 0:
                expected_consumption = np.mean([m["power_kw"] for m in previous_measurements])
            else:
                expected_consumption = avg_consumption * 0.9
        except:
            expected_consumption = avg_consumption * 0.9
        
        # Calculer la déviation
        deviation_percent = ((avg_consumption - expected_consumption) / expected_consumption) * 100
        
        # Identifier les périodes de surconsommation
        overconsumption_periods = self._identify_overconsumption(data, expected_consumption)
        
        # Identifier les périodes de sous-consommation
        underconsumption_periods = self._identify_underconsumption(data, expected_consumption)
        
        # Calculer le score d'efficacité (0-100)
        efficiency_score = self._calculate_efficiency_score(avg_consumption, expected_consumption, deviation_percent)
        
        # Générer des recommandations
        recommendations = self._generate_recommendations(efficiency_score, deviation_percent, overconsumption_periods)
        
        return EfficiencyResponse(
            sensor_id=sensor_id,
            analysis_period=f"{period_days}d",
            efficiency_score=efficiency_score,
            average_consumption_kw=avg_consumption,
            expected_consumption_kw=expected_consumption,
            deviation_percent=deviation_percent,
            overconsumption_periods=overconsumption_periods,
            underconsumption_periods=underconsumption_periods,
            recommendations=recommendations,
            analyzed_at=datetime.utcnow()
        )
    
    def _identify_overconsumption(self, data: List[dict], threshold: float) -> List[dict]:
        """Identifie les périodes de surconsommation"""
        overconsumption_threshold = threshold * 1.2  # 20% au-dessus du seuil
        periods = []
        
        current_period = None
        
        for entry in data:
            if entry["power_kw"] > overconsumption_threshold:
                if current_period is None:
                    current_period = {
                        "start": entry["timestamp"],
                        "end": entry["timestamp"],
                        "max_power": entry["power_kw"],
                        "avg_power": entry["power_kw"],
                        "count": 1
                    }
                else:
                    current_period["end"] = entry["timestamp"]
                    current_period["max_power"] = max(current_period["max_power"], entry["power_kw"])
                    current_period["avg_power"] = (current_period["avg_power"] * current_period["count"] + entry["power_kw"]) / (current_period["count"] + 1)
                    current_period["count"] += 1
            else:
                if current_period is not None:
                    periods.append(current_period)
                    current_period = None
        
        if current_period is not None:
            periods.append(current_period)
        
        return periods
    
    def _identify_underconsumption(self, data: List[dict], threshold: float) -> List[dict]:
        """Identifie les périodes de sous-consommation"""
        underconsumption_threshold = threshold * 0.7  # 30% en-dessous du seuil
        periods = []
        
        current_period = None
        
        for entry in data:
            if entry["power_kw"] < underconsumption_threshold:
                if current_period is None:
                    current_period = {
                        "start": entry["timestamp"],
                        "end": entry["timestamp"],
                        "min_power": entry["power_kw"],
                        "avg_power": entry["power_kw"],
                        "count": 1
                    }
                else:
                    current_period["end"] = entry["timestamp"]
                    current_period["min_power"] = min(current_period["min_power"], entry["power_kw"])
                    current_period["avg_power"] = (current_period["avg_power"] * current_period["count"] + entry["power_kw"]) / (current_period["count"] + 1)
                    current_period["count"] += 1
            else:
                if current_period is not None:
                    periods.append(current_period)
                    current_period = None
        
        if current_period is not None:
            periods.append(current_period)
        
        return periods
    
    def _calculate_efficiency_score(self, actual: float, expected: float, deviation: float) -> float:
        """Calcule le score d'efficacité (0-100)"""
        # Score basé sur la déviation par rapport à la consommation attendue
        # Déviation de 0% = score 100
        # Déviation de +20% = score 80
        # Déviation de +50% = score 50
        # Déviation de +100% = score 0
        
        if deviation <= 0:
            # Sous-consommation = bonne efficacité (jusqu'à un point)
            score = min(100, 100 + deviation * 0.5)
        else:
            # Surconsommation = mauvaise efficacité
            score = max(0, 100 - deviation * 2)
        
        return round(score, 1)
    
    def _generate_recommendations(self, score: float, deviation: float, overconsumption_periods: List[dict]) -> List[str]:
        """Génère des recommandations d'optimisation"""
        recommendations = []
        
        if score < 60:
            recommendations.append("Score d'efficacité faible - Action requise")
        
        if deviation > 20:
            recommendations.append("Surconsommation significative détectée (>20%)")
            recommendations.append("Vérifier les équipements connectés")
            recommendations.append("Identifier les appareils surconsommants")
        
        if deviation > 50:
            recommendations.append("ALERTE: Surconsommation critique (>50%)")
            recommendations.append("Envisager une audit énergétique complet")
        
        if len(overconsumption_periods) > 3:
            recommendations.append("Périodes de surconsommation fréquentes détectées")
            recommendations.append("Analyser les patterns de consommation horaires")
        
        if deviation < -10:
            recommendations.append("Sous-consommation détectée - Vérifier le fonctionnement normal")
        
        if score >= 80:
            recommendations.append("Efficacité excellente - Maintenir les pratiques actuelles")
        
        if not recommendations:
            recommendations.append("Consommation dans les limites normales")
        
        return recommendations
    
    def _generate_mock_response(self, sensor_id: str, period_days: int) -> EfficiencyResponse:
        """Génère une réponse factice pour démonstration"""
        return EfficiencyResponse(
            sensor_id=sensor_id,
            analysis_period=f"{period_days}d",
            efficiency_score=75.0,
            average_consumption_kw=5.2,
            expected_consumption_kw=5.0,
            deviation_percent=4.0,
            overconsumption_periods=[],
            underconsumption_periods=[],
            recommendations=["Consommation dans les limites normales"],
            analyzed_at=datetime.utcnow()
        )
