const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos SQLite local
const db = new sqlite3.Database('./tracker.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL,
    lon REAL,
    speed REAL,
    battery REAL,
    timestamp INTEGER
  )`);
});

// Receptor universal (Acepta JSON de tu propia app o parámetros de Traccar Client)
const handleLocation = (req, res) => {
  // Extraer datos ya sea de query params (Traccar) o body JSON
  const data = Object.keys(req.body).length > 0 ? req.body : req.query;
  
  const lat = parseFloat(data.lat || data.latitude);
  const lon = parseFloat(data.lon || data.lng || data.longitude);
  const speed = parseFloat(data.speed || 0);
  const battery = parseFloat(data.battery || data.batt || data.charge || 0);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Coordenadas no recibidas o inválidas' });
  }

  const timestamp = Date.now();

  db.run(
    `INSERT INTO locations (lat, lon, speed, battery, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [lat, lon, speed, battery, timestamp],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      console.log(`[GPS Recibido] Lat: ${lat}, Lon: ${lon}, Vel: ${speed} km/h, Bat: ${battery}%`);
      res.status(200).send('OK');
    }
  );
};

app.post('/api/location', handleLocation);
app.get('/api/location', handleLocation);

// Endpoint visor (iPhone / Safari)
app.get('/api/live', (req, res) => {
  db.all(
    `SELECT lat, lon, speed, battery, timestamp FROM locations ORDER BY id DESC LIMIT 500`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        current: rows[0] || null,
        history: rows.reverse()
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Servidor activo en: http://localhost:${PORT}`);
});