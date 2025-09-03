const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  contraseña: { type: String, required: true },
  rol: {
    type: String,
  enum: ['admin', 'entrenador', 'cliente', 'pendiente'],
    default: 'pendiente' 
  },
  sexo: { type: String, enum: ['masculino', 'femenino'] }
}, { timestamps: true });

// Hash de contraseña antes de guardar
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('contraseña')) return next();
  const salt = await bcrypt.genSalt(10);
  this.contraseña = await bcrypt.hash(this.contraseña, salt);
  next();
});

// Comparar contraseña
usuarioSchema.methods.compararPassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.contraseña);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
