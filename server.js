const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Almacenamiento en memoria para los últimos 500 puntos
const locations = [];

// Función para procesar y extraer coordenadas
function processData(data) {
  if (!data) return null;
  const loc = Array.isArray(data) ? data[0] : (data.location || data.coords || data);
  
  const lat = parseFloat(loc.lat || loc.latitude || (loc.geometry && loc.geometry.coordinates && loc.geometry.coordinates[1]));
  const lon = parseFloat(loc.lon || loc.lng || loc.longitude || (loc.geometry && loc.geometry.coordinates && loc.geometry.coordinates[0]));
  const speed = parseFloat(loc.speed || (loc.coords && loc.coords.speed) || 0);
  const battery = parseFloat(loc.battery && loc.battery.level ? loc.battery.level * 100 : (loc.battery || loc.batt || 0));

  if (!isNaN(lat) && !isNaN(lon)) {
    return { lat, lon, speed, battery, timestamp: Date.now() };
  }
  return null;
}

// 1. Endpoint que consulta el iPhone / Safari
app.get('/api/live', (req, res) => {
  const current = locations.length > 0 ? locations[locations.length - 1] : null;
  res.json({
    current: current,
    history: locations
  });
});

// 2. Receptor universal: acepta GET y POST en cualquier ruta que envíe la app
app.use((req, res) => {
  const point = processData(Object.keys(req.body).length > 0 ? req.body : req.query);

  if (point) {
    locations.push(point);
    if (locations.length > 500) locations.shift();
    console.log(`[GPS OK] Lat: ${point.lat}, Lon: ${point.lon}, Vel: ${point.speed} km/h, Bat: ${point.battery}%`);
    return res.status(200).send('OK');
  }

  // Respuesta por defecto para no rechazar peticiones de prueba
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});