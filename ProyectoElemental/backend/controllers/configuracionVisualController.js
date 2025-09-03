// controllers/configuracionVisualController.js
const path = require('path');
const ConfigVisual = require('../models/ConfiguracionVisual');

const isHHMM = (s) => /^\d{2}:\d{2}$/.test(s);
const isHex  = (s) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
const normHex = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : s);

// Valida payload. Si parcial=true, solo valida lo presente.
function validar(payload, parcial = false) {
  const e = [];
  const {
    disponibilidadAgendamiento,
    nombreGym,
    colorPrimario,
    colorSecundario,
    colorBotones
  } = payload || {};

  if (!parcial) {
    if (!nombreGym)       e.push('nombreGym es requerido.');
    if (!colorPrimario)   e.push('colorPrimario es requerido.');
    if (!colorSecundario) e.push('colorSecundario es requerido.');
    if (!colorBotones)    e.push('colorBotones es requerido.');
  }

  if (disponibilidadAgendamiento && !isHHMM(disponibilidadAgendamiento)) {
    e.push('disponibilidadAgendamiento debe tener formato HH:mm');
  }
  if (colorPrimario && !isHex(colorPrimario))     e.push('colorPrimario debe ser #rgb o #rrggbb');
  if (colorSecundario && !isHex(colorSecundario)) e.push('colorSecundario debe ser #rgb o #rrggbb');
  if (colorBotones && !isHex(colorBotones))       e.push('colorBotones debe ser #rgb o #rrggbb');

  return e;
}

// GET /api/config-visual -> última config (pública)
exports.obtenerActual = async (_req, res) => {
  try {
    const doc = await ConfigVisual.findOne().sort({ createdAt: -1 });
    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener', detalle: err.message });
  }
};

// GET /api/config-visual/:id (pública)
exports.obtenerPorId = async (req, res) => {
  try {
    const doc = await ConfigVisual.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener por id', detalle: err.message });
  }
};

// GET /api/config-visual/admin/all/list (solo admin)
exports.listar = async (_req, res) => {
  try {
    const items = await ConfigVisual.find().sort({ createdAt: -1 });
    return res.json({ ok: true, data: items });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al listar', detalle: err.message });
  }
};

// POST /api/config-visual (solo admin)
exports.crear = async (req, res) => {
  try {
    const body = req.body || {};
    const errores = validar(body, false);
    if (errores.length) return res.status(400).json({ ok: false, errores });

    const doc = await ConfigVisual.create({
      disponibilidadAgendamiento: body.disponibilidadAgendamiento || null,
      nombreGym: body.nombreGym,
      logo: body.logo || null,
      colorPrimario: normHex(body.colorPrimario),
      colorSecundario: normHex(body.colorSecundario),
      colorBotones: normHex(body.colorBotones), // 👈 clave
      realizadoPor: req.usuario?._id || null
    });

    return res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al crear', detalle: err.message });
  }
};

// PUT /api/config-visual/:id (solo admin)
exports.actualizar = async (req, res) => {
  try {
    const body = {
      ...req.body,
      colorPrimario: normHex(req.body?.colorPrimario),
      colorSecundario: normHex(req.body?.colorSecundario),
      colorBotones: normHex(req.body?.colorBotones)
    };
    const errores = validar(body, false);
    if (errores.length) return res.status(400).json({ ok: false, errores });

    const doc = await ConfigVisual.findByIdAndUpdate(
      req.params.id,
      { ...body, realizadoPor: req.usuario?._id || null },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar', detalle: err.message });
  }
};

// PATCH /api/config-visual/:id (solo admin, parcial)
exports.actualizarParcial = async (req, res) => {
  try {
    const body = {
      ...req.body,
      ...(req.body?.colorPrimario   ? { colorPrimario:   normHex(req.body.colorPrimario) }   : {}),
      ...(req.body?.colorSecundario ? { colorSecundario: normHex(req.body.colorSecundario) } : {}),
      ...(req.body?.colorBotones    ? { colorBotones:    normHex(req.body.colorBotones) }    : {})
    };
    const errores = validar(body, true);
    if (errores.length) return res.status(400).json({ ok: false, errores });

    const doc = await ConfigVisual.findByIdAndUpdate(
      req.params.id,
      { ...body, realizadoPor: req.usuario?._id || null },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar parcial', detalle: err.message });
  }
};

// PATCH /api/config-visual/:id/colors (solo admin)
exports.actualizarColores = async (req, res) => {
  try {
    const body = {
      ...(req.body?.colorPrimario   ? { colorPrimario:   normHex(req.body.colorPrimario) }   : {}),
      ...(req.body?.colorSecundario ? { colorSecundario: normHex(req.body.colorSecundario) } : {}),
      ...(req.body?.colorBotones    ? { colorBotones:    normHex(req.body.colorBotones) }    : {})
    };
    const errores = validar(body, true);
    if (errores.length) return res.status(400).json({ ok: false, errores });

    const doc = await ConfigVisual.findByIdAndUpdate(
      req.params.id,
      { ...body, realizadoPor: req.usuario?._id || null },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar colores', detalle: err.message });
  }
};

// POST /api/config-visual/:id/logo (solo admin)
exports.subirLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, mensaje: 'Archivo no recibido' });

    const rutaRelativa = path.posix.join('/uploads', 'logos', req.file.filename);

    const doc = await ConfigVisual.findByIdAndUpdate(
      req.params.id,
      { logo: rutaRelativa, realizadoPor: req.usuario?._id || null },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });

    return res.json({ ok: true, data: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al subir logo', detalle: err.message });
  }
};

// DELETE /api/config-visual/:id (solo admin)
exports.eliminar = async (req, res) => {
  try {
    const del = await ConfigVisual.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    return res.json({ ok: true, mensaje: 'Configuración eliminada' });
  } catch (err) {
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar', detalle: err.message });
  }
};
