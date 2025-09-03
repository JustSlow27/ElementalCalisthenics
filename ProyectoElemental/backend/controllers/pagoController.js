// controllers/pagoController.js
const Pago = require('../models/Pago');

/* Util: escapar texto para usar en RegExp */
const esc = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/pagos?estado=pendiente|pagado
 * Lista pagos (por estado opcional) SOLO de usuarios con rol 'cliente'.
 */
exports.listarPagos = async (req, res) => {
  try {
    const { estado } = req.query;
    const match = {};
    if (estado) match.estado = estado;

    const pagos = await Pago.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuarioId',
          foreignField: '_id',
          as: 'usuario'
        }
      },
      { $unwind: '$usuario' },
      { $match: { 'usuario.rol': 'cliente' } }, // 🔒 solo clientes
      {
        $lookup: {
          from: 'usuarios',
          localField: 'aprobadoPor',
          foreignField: '_id',
          as: 'aprobador'
        }
      },
      { $unwind: { path: '$aprobador', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          usuario: '$usuario.nombre',
          estado: 1,
          fechaPago: 1,
          observaciones: 1,
          aprobadoPor: '$aprobador.nombre',
          createdAt: 1,
          updatedAt: 1,
        }
      }
    ]);

    const data = pagos.map(p => ({
      usuario: p.usuario || '—',
      estado: p.estado,
      fechaPago: p.fechaPago,
      observaciones: p.observaciones || null,
      aprobadoPor: p.aprobadoPor || null,
      creado: p.createdAt,
      actualizado: p.updatedAt,
      _id: p._id,
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('listarPagos error:', err);
    return res.status(500).json({ ok: false, mensaje: 'Error al listar pagos' });
  }
};

/**
 * PATCH /api/pagos/:id/pagar
 * Marca como pagado, setea fechaPago = ahora y opcionalmente observaciones.
 */
exports.marcarPagado = async (req, res) => {
  try {
    const { id } = req.params;
    const { observaciones } = req.body || {};
    const ahora = new Date();

    const pago = await Pago.findByIdAndUpdate(
      id,
      {
        estado: 'pagado',
        fechaPago: ahora,
        aprobadoPor: req.usuario?._id || null,
        ...(observaciones !== undefined ? { observaciones } : {}),
      },
      { new: true }
    )
      .populate('usuarioId', 'nombre rol') // (solo lectura; no filtramos aquí)
      .populate('aprobadoPor', 'nombre');

    if (!pago) return res.status(404).json({ ok: false, mensaje: 'Pago no encontrado' });

    return res.json({ ok: true, data: pago });
  } catch (err) {
    console.error('marcarPagado error:', err);
    return res.status(500).json({ ok: false, mensaje: 'Error al marcar pagado' });
  }
};

/**
 * (Opcional) POST /api/pagos/crear-pendiente/:usuarioId
 * Crea un pendiente para un usuario (si no existe ya uno pendiente).
 * (Si quieres, aquí puedes validar que el usuario sea 'cliente' antes de crear).
 */
exports.crearPendienteParaUsuario = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const pago = await Pago.create({ usuarioId, estado: 'pendiente' });
    return res.status(201).json({ ok: true, data: pago });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe un pago pendiente para este usuario' });
    }
    console.error('crearPendienteParaUsuario error:', err);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear pago pendiente' });
  }
};

/**
 * GET /api/pagos/buscar?estado=pendiente&nombre=pa
 * Filtra por estado y coincidencia parcial de nombre SOLO para clientes.
 */
exports.buscarPagos = async (req, res) => {
  try {
    const { estado, nombre } = req.query;
    const match = {};
    if (estado) match.estado = estado;

    const regex = (nombre && nombre.trim())
      ? new RegExp(esc(nombre.trim()), 'i')
      : null;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuarioId',
          foreignField: '_id',
          as: 'usuario'
        }
      },
      { $unwind: '$usuario' },
      { $match: { 'usuario.rol': 'cliente' } }, // 🔒 solo clientes
    ];

    if (regex) pipeline.push({ $match: { 'usuario.nombre': regex } });

    pipeline.push(
      {
        $lookup: {
          from: 'usuarios',
          localField: 'aprobadoPor',
          foreignField: '_id',
          as: 'aprobador'
        }
      },
      { $unwind: { path: '$aprobador', preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          usuario: '$usuario.nombre',
          estado: 1,
          fechaPago: 1,
          observaciones: 1,
          aprobadoPor: '$aprobador.nombre',
          createdAt: 1,
          updatedAt: 1,
        }
      }
    );

    const pagos = await Pago.aggregate(pipeline);

    const data = pagos.map(p => ({
      usuario: p.usuario || '—',
      estado: p.estado,
      fechaPago: p.fechaPago,
      observaciones: p.observaciones || null,
      aprobadoPor: p.aprobadoPor || null,
      creado: p.createdAt,
      actualizado: p.updatedAt,
      _id: p._id,
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('buscarPagos error:', err);
    return res.status(500).json({ ok: false, mensaje: 'Error al buscar pagos' });
  }
};

/**
 * GET /api/pagos/autocomplete?estado=pendiente&q=pa
 * Autocomplete de NOMBRES Solo para clientes (hasta 10).
 */
exports.autocompleteNombresPendientes = async (req, res) => {
  try {
    const { q = '', estado = 'pendiente' } = req.query;
    const regex = q.trim() ? new RegExp(esc(q.trim()), 'i') : null;

    const pipeline = [
      { $match: { estado } },
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuarioId',
          foreignField: '_id',
          as: 'usuario'
        }
      },
      { $unwind: '$usuario' },
      { $match: { 'usuario.rol': 'cliente' } }, // 🔒 solo clientes
    ];

    if (regex) pipeline.push({ $match: { 'usuario.nombre': regex } });

    pipeline.push(
      { $group: { _id: '$usuario._id', nombre: { $first: '$usuario.nombre' } } },
      { $sort: { nombre: 1 } },
      { $limit: 10 }
    );

    const rows = await Pago.aggregate(pipeline);
    const nombres = rows.map(r => r.nombre);
    return res.json({ ok: true, data: nombres });
  } catch (err) {
    console.error('autocompleteNombresPendientes error:', err);
    return res.status(500).json({ ok: false, mensaje: 'Error en autocomplete' });
  }
};

/**
 * GET /api/pagos/por-fecha?anio=2025&mes=9&nombre=pa
 * Histórico SOLO de pagos "pagado" y SOLO clientes.
 * Rango mensual por fechaPago: [inicioMes, inicioMesSiguiente).
 */
exports.listarPagosPorFecha = async (req, res) => {
  try {
    let { anio, mes, nombre } = req.query;

    anio = parseInt(anio, 10);
    mes  = parseInt(mes, 10);
    if (!anio || !mes || mes < 1 || mes > 12) {
      return res.status(400).json({ ok: false, mensaje: 'Parámetros inválidos: anio y mes son obligatorios' });
    }

    const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
    const fin       = new Date(anio, mes,     1, 0, 0, 0, 0); // exclusivo

    const regex = (nombre && nombre.trim()) ? new RegExp(esc(nombre.trim()), 'i') : null;

    const pipeline = [
      { $match: { estado: 'pagado', fechaPago: { $gte: inicioMes, $lt: fin } } },
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuarioId',
          foreignField: '_id',
          as: 'usuario'
        }
      },
      { $unwind: '$usuario' },
      { $match: { 'usuario.rol': 'cliente' } }, // 🔒 solo clientes
    ];

    if (regex) pipeline.push({ $match: { 'usuario.nombre': regex } });

    pipeline.push(
      {
        $lookup: {
          from: 'usuarios',
          localField: 'aprobadoPor',
          foreignField: '_id',
          as: 'aprobador'
        }
      },
      { $unwind: { path: '$aprobador', preserveNullAndEmptyArrays: true } },
      { $sort: { fechaPago: -1 } },
      {
        $project: {
          _id: 1,
          usuario: '$usuario.nombre',
          estado: 1,
          fechaPago: 1,
          observaciones: 1,
          aprobadoPor: '$aprobador.nombre',
          createdAt: 1,
          updatedAt: 1,
        }
      }
    );

    const pagos = await Pago.aggregate(pipeline);
    const data = pagos.map(p => ({
      _id: p._id,
      usuario: p.usuario || '—',
      estado: p.estado,
      fechaPago: p.fechaPago,
      observaciones: p.observaciones || null,
      aprobadoPor: p.aprobadoPor || null,
      creado: p.createdAt,
      actualizado: p.updatedAt,
    }));

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('listarPagosPorFecha error:', err);
    return res.status(500).json({ ok: false, mensaje: 'Error al listar por fecha' });
  }
};

/**
 * PATCH /api/pagos/:id/estado
 * body: { estado: 'pendiente' | 'pagado', observaciones? }
 * Revertir o marcar pagado (sin restricción de rol aquí porque es por ID de pago).
 */
exports.actualizarEstadoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones } = req.body || {};

    if (!['pendiente', 'pagado'].includes(estado)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado inválido' });
    }

    const pago = await Pago.findById(id);
    if (!pago) return res.status(404).json({ ok: false, mensaje: 'Pago no encontrado' });

    if (estado === 'pendiente') {
      const existeOtroPendiente = await Pago.exists({
        usuarioId: pago.usuarioId,
        estado: 'pendiente',
        _id: { $ne: pago._id }
      });
      if (existeOtroPendiente) {
        return res.status(409).json({
          ok: false,
          mensaje: 'Ya existe un pago pendiente para este usuario. No se puede revertir.'
        });
      }
      pago.estado = 'pendiente';
      pago.fechaPago = null;
      pago.aprobadoPor = null;
      if (observaciones !== undefined) pago.observaciones = observaciones;
    } else {
      pago.estado = 'pagado';
      pago.fechaPago = new Date();
      pago.aprobadoPor = req.usuario?._id || null;
      if (observaciones !== undefined) pago.observaciones = observaciones;
    }

    await pago.save();
    await pago.populate([
      { path: 'usuarioId', select: 'nombre rol' },
      { path: 'aprobadoPor', select: 'nombre' }
    ]);

    return res.json({
      ok: true,
      data: {
        _id: pago._id,
        usuario: pago.usuarioId?.nombre || '—',
        estado: pago.estado,
        fechaPago: pago.fechaPago,
        observaciones: pago.observaciones || null,
        aprobadoPor: pago.aprobadoPor?.nombre || null,
        creado: pago.createdAt,
        actualizado: pago.updatedAt,
      }
    });
  } catch (err) {
    console.error('actualizarEstadoPago error:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ ok: false, mensaje: 'Conflicto de pendiente duplicado' });
    }
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar estado' });
  }
};

