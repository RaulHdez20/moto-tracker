const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'history.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ahora guardaremos los datos agrupados por ID del dispositivo
let devices = {};
if (fs.existsSync(DB_FILE)) {
  try {
    devices = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    devices = {};
  }
}

function processData(data) {
  if (!data) return null;
  const loc = Array.isArray(data) ? data[0] : (data.location || data.coords || data);
  
  const lat = parseFloat(loc.lat || loc.latitude || (loc.geometry && loc.geometry.coordinates[1]));
  const lon = parseFloat(loc.lon || loc.lng || loc.longitude || (loc.geometry && loc.geometry.coordinates[0]));
  const speed = parseFloat(loc.speed || (loc.coords && loc.coords.speed) || 0);
  const battery = parseFloat(loc.battery && loc.battery.level ? loc.battery.level * 100 : (loc.battery || loc.batt || 0));
  
  // Traccar Client envía el nombre del dispositivo en el parámetro 'id'
  const id = data.id || data.deviceid || 'Jugador 1';

  if (!isNaN(lat) && !isNaN(lon)) {
    return { id, lat, lon, speed, battery, timestamp: Date.now() };
  }
  return null;
}

// Endpoint que devuelve TODOS los dispositivos para el mapa familiar
app.get('/api/live', (req, res) => {
  const response = {};
  for (const id in devices) {
    const history = devices[id];
    response[id] = {
      current: history.length > 0 ? history[history.length - 1] : null,
      history: history
    };
  }
  res.json(response);
});

// Receptor de ubicaciones
app.use((req, res) => {
  if (req.path === '/api/live' || (req.path === '/' && req.method === 'GET')) return res.status(200).send('OK');

  const point = processData(Object.keys(req.body).length > 0 ? req.body : req.query);

  if (point) {
    if (!devices[point.id]) devices[point.id] = []; // Crear perfil si es nuevo familiar
    devices[point.id].push(point);
    if (devices[point.id].length > 200) devices[point.id].shift(); // Máximo 200 puntos por persona
    
    console.log(`[Rastreo] ${point.id} | Lat: ${point.lat}, Lon: ${point.lon}`);
    return res.status(200).send('OK');
  }
  res.status(200).send('OK');
});

// Guardar historial
setInterval(() => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(devices));
  } catch (e) {}
}, 30000);

app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));