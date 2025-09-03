// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());


app.get('/', (req, res) => {
  res.send('API funcionando');
});

// ✅ Rutas de autenticación (registro y login)
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
// ✅ Rutas protegidas para usuarios
const usuarioRoutes = require('./routes/usuarioRoutes');
app.use('/api', usuarioRoutes);
app.use('/api/config-horarios', require('./routes/configHorarioRoutes'));
app.use('/api/config-visual', require('./routes/configuracionVisualRoutes'));
app.use('/api/ejercicios', require('./routes/ejercicioRoutes'));
app.use('/api', require('./routes/usuarioRoutes'));
app.use('/api', require('./routes/pagoRoutes'));
const rutinaRoutes = require('./routes/rutinaRoutes');
app.use('/api/rutinas', rutinaRoutes);
app.use('/api/agendamientoRT', require('./routes/agendamientoRTRoutes'));


app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'frontend'))); // Sirve HTML como login.html, dashboard.html...
app.use('/utils', express.static(path.join(__dirname, 'utils'))); // Sirve archivos CSS o JS personalizados
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Para logos o imágenes subidas

const cron = require('node-cron');
const { resetPendientesMesJob } = require('./controllers/pagoController');

// Ejecuta cada mes el día 1 a las 00:05 (hora del servidor)
cron.schedule('5 0 1 * *', async () => {
  console.log('⏰ Reset mensual: poniendo todos los pagos del mes en pendiente…');
  try {
    await resetPendientesMesJob();
    console.log('✅ Reset mensual aplicado');
  } catch (e) {
    console.error('❌ Error en reset mensual', e);
  }
});
// ==== Socket.IO ====
const http = require('http');
const { Server } = require('socket.io');
const attachAgendaSockets = require('./sockets/agendaRT');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });
app.set('io', io);

// Enchufar sockets
attachAgendaSockets(io);

// Conectar Mongo y arrancar
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB');
    server.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Error al conectar a MongoDB:', err);
    process.exit(1);
  });