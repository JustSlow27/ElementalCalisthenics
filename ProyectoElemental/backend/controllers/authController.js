// controllers/authController.js
const Usuario = require('../models/Usuario');
const Pago    = require('../models/Pago');           
const generarToken = require('../utils/generarToken');

const registrarUsuario = async (req, res) => {
  try {
    const { nombre, contraseña, sexo } = req.body;

    const yaExiste = await Usuario.findOne({ nombre });
    if (yaExiste) {
      return res.status(409).json({ mensaje: 'El nombre de usuario ya está en uso' });
    }

    const nuevoUsuario = new Usuario({ nombre, contraseña, sexo, rol: 'pendiente' });
    await nuevoUsuario.save();

    // 👇 Pago minimal: SOLO usuarioId y estado (sin mes, sin año, sin fecha)
    await Pago.create({ usuarioId: nuevoUsuario._id, estado: 'pendiente' });

    const token = generarToken(nuevoUsuario);

    return res.status(201).json({
      mensaje: 'Usuario creado con rol pendiente y registro de pago pendiente creado',
      _id: nuevoUsuario._id,
      nombre: nuevoUsuario.nombre,
      rol: nuevoUsuario.rol,
      sexo: nuevoUsuario.sexo,
      token
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ mensaje: 'Error al crear usuario' });
  }
};

// POST /api/auth/login
const loginUsuario = async (req, res) => {
  try {
    const { nombre, contraseña } = req.body;

    const usuario = await Usuario.findOne({ nombre });
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const ok = await usuario.compararPassword(contraseña);
    if (!ok) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

    if (String(usuario.rol).toLowerCase() === 'pendiente') {
      return res.status(403).json({ mensaje: 'Tu cuenta no está activa' });
    }

    const token = generarToken(usuario);
    return res.json({
      _id: usuario._id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      sexo: usuario.sexo,
      token
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

module.exports = { registrarUsuario, loginUsuario };
