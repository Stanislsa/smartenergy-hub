// Insère des capteurs et un résumé d'exemple (rejouable sans créer de doublons)
const now = new Date();

[
  { sensorId: "SENSOR-001", name: "Compteur salle serveur", building: "Bâtiment A", floor: 1, maxPowerKw: 8.0,  active: true,  tags: ["critical", "server-room"] },
  { sensorId: "SENSOR-002", name: "Compteur atelier",       building: "Bâtiment B", floor: 0, maxPowerKw: 12.0, active: true,  tags: ["workshop"] },
  { sensorId: "SENSOR-003", name: "Compteur bureaux",       building: "Bâtiment A", floor: 2, maxPowerKw: 5.0,  active: false, tags: [] }
].forEach(s => db.sensors.updateOne(
  { sensorId: s.sensorId },
  { $setOnInsert: { ...s, createdAt: now, updatedAt: now } },
  { upsert: true }
));

db.daily_summaries.updateOne(
  { sensorId: "SENSOR-001", date: "2026-09-30" },
  { $setOnInsert: { avgPowerKw: 3.42, maxPowerKw: 7.81, energyKwh: 68.2, anomalyCount: 2 } },
  { upsert: true }
);