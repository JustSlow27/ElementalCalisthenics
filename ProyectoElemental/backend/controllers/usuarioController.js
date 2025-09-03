const Usuario = require('../models/Usuario');
const Pago    = require('../models/Pago'); // <-- FALTABA

const ROLES_VALIDOS = ['admin', 'entrenador', 'cliente'];
const ROLES_FILTRO  = ['pendiente', 'entrenador', 'cliente'];
const esc = (s='') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/usuarios (solo admin)
const obtenerUsuarios = async (_req, res) => {
  try {
    const usuarios = await Usuario.find().select('-contraseña').sort({ createdAt: -1 });
    res.json({ ok: true, data: usuarios });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al obtener usuarios' });
  }
};

// GET /api/usuarios/pendientes (solo admin) -> por ROL pendiente
const obtenerPendientes = async (_req, res) => {
  try {
    const usuarios = await Usuario.find({ rol: 'pendiente' })
      .select('-contraseña')
      .sort({ createdAt: -1 });
    res.json({ ok: true, data: usuarios });
  } catch (error) {
    console.error('Error al obtener pendientes:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al obtener usuarios pendientes' });
  }
};

// PATCH /api/usuarios/:id/rol (solo admin) -> asigna rol definitivo
const asignarRol = async (req, res) => {
  try {
    let { rol } = req.body || {};
    if (!rol) return res.status(400).json({ ok: false, mensaje: 'Debe enviar el rol' });

    rol = String(rol).toLowerCase();
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ ok: false, mensaje: 'Rol no válido. Use admin, entrenador o cliente' });
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { rol },
      { new: true }
    ).select('-contraseña');

    if (!usuario) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    res.json({ ok: true, mensaje: 'Rol asignado', data: usuario });
  } catch (error) {
    console.error('Error al asignar rol:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al asignar rol' });
  }
};
const filtrarUsuarios = async (req, res) => {
  try {
    const { roles = '', nombre = '' } = req.query;

    let rolesArr = String(roles)
      .split(',')
      .map(r => r.trim().toLowerCase())
      .filter(r => r && ROLES_FILTRO.includes(r));

    const filtro = {};
    // Siempre excluimos admin
    if (rolesArr.length === 0) {
      filtro.rol = { $in: ROLES_FILTRO };
    } else if (rolesArr.length === 1) {
      filtro.rol = rolesArr[0];
    } else {
      filtro.rol = { $in: rolesArr };
    }

    if (nombre && nombre.trim()) {
      filtro.nombre = { $regex: new RegExp(esc(nombre.trim()), 'i') };
    }

    const usuarios = await Usuario.find(filtro)
      .select('-contraseña')
      .sort({ createdAt: -1 });

    return res.json({ ok: true, data: usuarios });
  } catch (error) {
    console.error('Error al filtrar usuarios:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al filtrar usuarios' });
  }
};

/**
 * DELETE /api/usuarios/:id
 * - Solo elimina si es cliente y sin pagos asociados
 */
const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const force = String(req.query.force || '').toLowerCase() === 'true';

    const u = await Usuario.findById(id).select('rol');
    if (!u) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    if (u.rol === 'admin') {
      return res.status(400).json({ ok: false, mensaje: 'No se puede eliminar un administrador' });
    }
    if (!['cliente', 'entrenador'].includes(u.rol)) {
      return res.status(400).json({ ok: false, mensaje: 'Solo se elimina entrenador o cliente' });
    }

    const tienePagos = await Pago.exists({ usuarioId: id });

    if (tienePagos && !force) {
      return res.status(409).json({ ok: false, mensaje: 'No se puede eliminar: el usuario tiene pagos asociados' });
    }

    let pagosEliminados = 0;
    if (tienePagos && force) {
      const del = await Pago.deleteMany({ usuarioId: id });
      pagosEliminados = del?.deletedCount || 0;
    }

    // Si el usuario aparece como aprobador en otros pagos, dejarlo en null
    await Pago.updateMany({ aprobadoPor: id }, { $set: { aprobadoPor: null } });

    await Usuario.findByIdAndDelete(id);

    return res.json({
      ok: true,
      mensaje: force
        ? `Usuario eliminado. Pagos eliminados: ${pagosEliminados}.`
        : 'Usuario eliminado.'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar usuario' });
  }
};

module.exports = {
  obtenerUsuarios,
  obtenerPendientes,
  asignarRol,
  filtrarUsuarios,
  eliminarUsuario,
};