// models/Pago.js
const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  estado: { type: String, enum: ['pendiente', 'pagado'], default: 'pendiente' },
  fechaPago: { type: Date, default: null },          // se setea SOLO cuando pasa a “pagado”
  observaciones: { type: String, default: null },
  aprobadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
}, { timestamps: true });

// Evita tener más de 1 “pendiente” por usuario (pero permite múltiples pagos “pagado” históricos)
pagoSchema.index(
  { usuarioId: 1, estado: 1 },
  { unique: true, partialFilterExpression: { estado: 'pendiente' } }
);

module.exports = mongoose.model('Pago', pagoSchema);
