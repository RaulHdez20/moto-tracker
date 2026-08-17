const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'history.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let locations = [];
if (fs.existsSync(DB_FILE)) {
  try {
    locations = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    locations = [];
  }
}

// Función para extraer coordenadas de cualquier formato de app
function extractLocation(req) {
  const body = req.body || {};
  const query = req.query || {};
  const data = Object.keys(body).length > 0 ? body : query;

  // Si viene envuelto en un array o en propiedad 'location' / 'coords'
  const loc = Array.isArray(data) ? data[0] : (data.location || data.coords || data);

  const lat = parseFloat(loc.lat || loc.latitude || loc.geometry?.coordinates?.[1]);
  const lon = parseFloat(loc.lon || loc.lng || loc.longitude || loc.geometry?.coordinates?.[0]);
  const speed = parseFloat(loc.speed || loc.coords?.speed || 0);
  const battery = parseFloat(loc.battery?.level ? loc.battery.level * 100 : (loc.battery || loc.batt || 0));

  if (!isNaN(lat) && !isNaN(lon)) {
    return { lat, lon, speed, battery, timestamp: Date.now() };
  }
  return null;
}

// Endpoint de visor para Safari/iPhone
app.get('/api/live', (req, res) => {
  const current = locations.length > 0 ? locations[locations.length - 1] : null;
  res.json({
    current,
    history: locations
  });
});

// Receptor que captura TODO (POST / GET a /api/location, /, /locations, etc.)
app.all('*', (req, res) => {
  // Ignorar peticiones a archivos estáticos o /api/live
  if (req.path === '/api/live' || req.path === '/' && req.method === 'GET') {
    return res.status(200).send('OK');
  }

  const point = extractLocation(req);

  if (point) {
    locations.push(point);
    if (locations.length > 500) locations.shift();
    console.log(`[GPS OK] Lat: ${point.lat}, Lon: ${point.lon}, Vel: ${point.speed}, Bat: ${point.battery}%`);
    return res.status(200).json({ status: 'success' });
  }

  console.log(`[Petición recibida en ${req.method} ${req.path}]`, req.body || req.query);
  res.status(200).send('OK');
});

// Guardar historial periódicamente
setInterval(() => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(locations.slice(-500)));
  } catch (e) {
    console.error('Error al guardar historial:', e);
  }
}, 30000);

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});