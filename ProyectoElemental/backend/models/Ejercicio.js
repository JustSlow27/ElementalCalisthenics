const mongoose = require('mongoose');

const ejercicioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: String,
  tipo: String
}, { timestamps: true });

ejercicioSchema.index({ nombre: 1 }, { collation: { locale: 'es', strength: 2 } });

module.exports = mongoose.model('Ejercicio', ejercicioSchema);