const mongoose = require('mongoose');

const configuracionVisualSchema = new mongoose.Schema({
  disponibilidadAgendamiento: String, // formato "HH:mm"
  nombreGym: String,
  logo: String,
  colorPrimario: String,
  colorSecundario: String,
  colorBotones: String,
  realizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }
}, { timestamps: true });

module.exports = mongoose.model('ConfiguracionVisual', configuracionVisualSchema);
