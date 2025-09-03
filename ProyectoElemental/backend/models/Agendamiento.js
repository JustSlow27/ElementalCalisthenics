const mongoose = require('mongoose');

const agendamientoSchema = new mongoose.Schema({
  idConfigHorario: { type: mongoose.Schema.Types.ObjectId, ref: 'ConfigHorario', required: true },
  idUsuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  fecha:           { type: Date, required: true }, // medianoche del día activo
  expiresAt:       { type: Date, required: true }  // ← se setea al cutoff del día activo
}, { timestamps: true });

agendamientoSchema.index({ fecha: 1, idConfigHorario: 1, idUsuario: 1 }, { unique: true });
agendamientoSchema.index({ fecha: 1, idConfigHorario: 1 });
agendamientoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Agendamiento', agendamientoSchema);
