// models/Rutina.js
const mongoose = require('mongoose');

const rutinaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  genero: { type: String, required: true },
  semana: { type: Number, required: true } // 👈 nuevo
}, { timestamps: true });

module.exports = mongoose.model('Rutina', rutinaSchema);
