const mongoose = require('mongoose');

const configHorarioSchema = new mongoose.Schema({
  dia: String,
  hInicio: String, // formato "HH:mm"
  hFin: String,    // formato "HH:mm"
  cupoHombres: Number,
  cupoMujeres: Number
}, { timestamps: true });

module.exports = mongoose.model('ConfigHorario', configHorarioSchema);