const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'history.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cargar historial previo si existe
let locations = [];
if (fs.existsSync(DB_FILE)) {
  try {
    locations = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    locations = [];
  }
}

// Guardar en disco cada 30 segundos para no saturar escritura
setInterval(() => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(locations.slice(-500)));
  } catch (e) {
    console.error('Error guardando historial:', e);
  }
}, 30000);

// Receptor universal (Traccar Client o JSON directo)
const handleLocation = (req, res) => {
  const data = Object.keys(req.body).length > 0 ? req.body : req.query;
  
  const lat = parseFloat(data.lat || data.latitude);
  const lon = parseFloat(data.lon || data.lng || data.longitude);
  const speed = parseFloat(data.speed || 0);
  const battery = parseFloat(data.battery || data.batt || data.charge || 0);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Coordenadas inválidas' });
  }

  const point = {
    lat,
    lon,
    speed,
    battery,
    timestamp: Date.now()
  };

  locations.push(point);
  if (locations.length > 500) locations.shift(); // Mantener los últimos 500 puntos

  console.log(`[GPS Recibido] Lat: ${lat}, Lon: ${lon}, Vel: ${speed} km/h, Bat: ${battery}%`);
  res.status(200).send('OK');
};

app.post('/api/location', handleLocation);
app.get('/api/location', handleLocation);

// Endpoint visor (Safari / Web)
app.get('/api/live', (req, res) => {
  const current = locations.length > 0 ? locations[locations.length - 1] : null;
  res.json({
    current,
    history: locations
  });
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});