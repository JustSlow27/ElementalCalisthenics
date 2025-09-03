// controllers/ejercicio.controller.js
const Ejercicio = require('../models/Ejercicio');

// Helpers
const sanitize = (s) => (typeof s === 'string' ? s.trim() : s);

// Crear (admin, entrenador)
exports.crearEjercicio = async (req, res) => {
  try {
    const { nombre, descripcion, tipo } = req.body || {};
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'El nombre es obligatorio' });
    }

    // Evitar duplicados por nombre (case-insensitive)
    const existe = await Ejercicio.findOne({ nombre: new RegExp(`^${sanitize(nombre)}$`, 'i') });
    if (existe) return res.status(409).json({ ok: false, mensaje: 'Ya existe un ejercicio con ese nombre' });

    const doc = await Ejercicio.create({
      nombre: sanitize(nombre),
      descripcion: sanitize(descripcion) || '',
      tipo: sanitize(tipo) || ''
    });

    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al crear', detalle: err.message });
  }
};

// Listar con búsqueda y filtros (admin, entrenador, cliente)
exports.listar = async (req, res) => {
  try {
    const { q, tipo, page = 1, limit = 20, sort = 'nombre' } = req.query;

    const filtro = {};
    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), 'i');
      filtro.$or = [{ nombre: rx }, { descripcion: rx }, { tipo: rx }];
    }
    if (tipo && tipo.trim()) filtro.tipo = new RegExp(`^${tipo.trim()}$`, 'i');

    const skip = (Math.max(+page, 1) - 1) * Math.max(+limit, 1);
    const [items, total] = await Promise.all([
      Ejercicio.find(filtro).sort(sort).skip(skip).limit(Math.max(+limit, 1)),
      Ejercicio.countDocuments(filtro)
    ]);

    res.json({
      ok: true,
      data: items,
      meta: {
        total,
        page: +page,
        pages: Math.ceil(total / Math.max(+limit, 1)),
        limit: +limit
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al listar', detalle: err.message });
  }
};

// Obtener por ID (admin, entrenador, cliente)
exports.obtener = async (req, res) => {
  try {
    const doc = await Ejercicio.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al obtener', detalle: err.message });
  }
};

// Actualizar (PUT/PATCH) (admin, entrenador)
exports.actualizar = async (req, res) => {
  try {
    const body = {};
    if (req.body.nombre !== undefined) body.nombre = sanitize(req.body.nombre);
    if (req.body.descripcion !== undefined) body.descripcion = sanitize(req.body.descripcion);
    if (req.body.tipo !== undefined) body.tipo = sanitize(req.body.tipo);

    if (body.nombre && body.nombre.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'El nombre no puede estar vacío' });
    }

    // Evitar duplicado de nombre al actualizar
    if (body.nombre) {
      const existe = await Ejercicio.findOne({
        _id: { $ne: req.params.id },
        nombre: new RegExp(`^${body.nombre}$`, 'i')
      });
      if (existe) return res.status(409).json({ ok: false, mensaje: 'Ya existe otro ejercicio con ese nombre' });
    }

    const doc = await Ejercicio.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!doc) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });

    res.json({ ok: true, data: doc });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar', detalle: err.message });
  }
};

// Eliminar (admin)
exports.eliminar = async (req, res) => {
  try {
    const del = await Ejercicio.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    res.json({ ok: true, mensaje: 'Ejercicio eliminado' });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al eliminar', detalle: err.message });
  }
};

exports.buscarNombres = async (req, res) => {
  try {
    const qRaw = (req.query.search || '').trim();
    const lim = Math.min(Number(req.query.limit) || 8, 20);
    if (qRaw.length < 2) return res.json([]);

    // Prefijo para aprovechar índice en { nombre: 1 }
    const safe = qRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('^' + safe, 'i');

    const resultados = await Ejercicio
      .find({ nombre: regex }, { _id:1, nombre: 1 })
      .collation({ locale: 'es', strength: 2 })
      .sort({ nombre: 1 })
      .limit(lim)
      .lean();

    res.json(resultados); // [{ nombre }]
  } catch (err) {
    console.error('Error buscando ejercicios:', err);
    res.status(500).json({ error: 'Error al buscar ejercicios' });
  }
};