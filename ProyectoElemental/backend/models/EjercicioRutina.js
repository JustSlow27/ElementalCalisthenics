// models/EjercicioRutina.js
const mongoose = require('mongoose');

const ejercicioRutinaSchema = new mongoose.Schema({
  ejercicioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejercicio', required: true },
  rutinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rutina', required: true },
  reps: Number,
  dia: { type: String, required: true } // 👈 nuevo campo
}, { timestamps: true });

module.exports = mongoose.model('EjercicioRutina', ejercicioRutinaSchema);
