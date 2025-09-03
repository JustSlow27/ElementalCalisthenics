// controllers/configHorario.controller.js
const ConfigHorario = require('../models/ConfigHorario');

// Helpers de validación
function isHHMM(str) {
  return /^\d{2}:\d{2}$/.test(str);
}
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
const DIAS_VALIDOS = [
  'lunes','martes','miercoles','miércoles','jueves','viernes','sabado','sábado','domingo'
];

function validarPayload({ dia, hInicio, hFin, cupoHombres, cupoMujeres }) {
  const errores = [];

  if (!dia || !DIAS_VALIDOS.includes(dia.toLowerCase())) {
    errores.push('El campo "dia" es obligatorio y debe ser un día válido (lunes..domingo).');
  }
  if (!hInicio || !isHHMM(hInicio)) errores.push('hInicio debe tener formato "HH:mm".');
  if (!hFin || !isHHMM(hFin)) errores.push('hFin debe tener formato "HH:mm".');

  if (isHHMM(hInicio) && isHHMM(hFin)) {
    if (toMinutes(hInicio) >= toMinutes(hFin)) {
      errores.push('hInicio debe ser menor que hFin.');
    }
  }

  if (cupoHombres != null && (!Number.isInteger(+cupoHombres) || +cupoHombres < 0)) {
    errores.push('cupoHombres debe ser un entero ≥ 0.');
  }
  if (cupoMujeres != null && (!Number.isInteger(+cupoMujeres) || +cupoMujeres < 0)) {
    errores.push('cupoMujeres debe ser un entero ≥ 0.');
  }

  return errores;
}

// Crear
exports.crear = async (req, res) => {
  try {
    const errores = validarPayload(req.body);
    if (errores.length) return res.status(400).json({ ok: false, errores });

    // Evitar duplicados exactos (mismo día y misma franja)
    const existe = await ConfigHorario.findOne({
      dia: req.body.dia,
      hInicio: req.body.hInicio,
      hFin: req.body.hFin
    });
    if (existe) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe un horario con ese día y franja.' });
    }

    const doc = await ConfigHorario.create(req.body);
    res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al crear horario', detalle: err.message });
  }
};

// Listar (opcional filtro por día)
exports.listar = async (req, res) => {
  try {
    const { dia } = req.query;
    const filtro = dia ? { dia } : {};
    const items = await ConfigHorario.find(filtro).sort({ dia: 1, hInicio: 1 });
    res.json({ ok: true, data: items });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al obtener horarios', detalle: err.message });
  }
};

// Obtener por ID
exports.obtener = async (req, res) => {
  try {
    const item = await ConfigHorario.findById(req.params.id);
    if (!item) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al obtener', detalle: err.message });
  }
};

// Actualizar (PUT/PATCH)
exports.actualizar = async (req, res) => {
  try {
    const errores = validarPayload({ ...req.body, ...{ dia: req.body.dia ?? 'lunes' } }); // fuerza validaciones si envían campos
    // Nota: Si quieres permitir PATCH parcial, elimina validaciones de campos no enviados.
    // Alternativa: validar solo los presentes:
    // const errores = validarPayloadParcial(req.body)
    if (errores.length && (req.method === 'PUT')) {
      return res.status(400).json({ ok: false, errores });
    }
    if (req.body.hInicio && req.body.hFin) {
      if (toMinutes(req.body.hInicio) >= toMinutes(req.body.hFin)) {
        return res.status(400).json({ ok: false, errores: ['hInicio debe ser menor que hFin.'] });
      }
    }

    const item = await ConfigHorario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    res.json({ ok: true, data: item });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar', detalle: err.message });
  }
};

// Eliminar
exports.eliminar = async (req, res) => {
  try {
    const del = await ConfigHorario.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ ok: false, mensaje: 'No encontrado' });
    res.json({ ok: true, mensaje: 'Horario eliminado' });
  } catch (err) {
    res.status(500).json({ ok: false, mensaje: 'Error al eliminar', detalle: err.message });
  }
};
