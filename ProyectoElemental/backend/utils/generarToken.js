// utils/generarToken.js
const jwt = require('jsonwebtoken');

module.exports = function generarToken(usuario) {
  return jwt.sign(
    { id: usuario._id, rol: usuario.rol, nombre: usuario.nombre, sexo: usuario.sexo },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};
