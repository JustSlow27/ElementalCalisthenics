// backend/controllers/agendamientoRTController.js
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc'); dayjs.extend(utc);
const tz = require('dayjs/plugin/timezone'); dayjs.extend(tz);

const Agendamiento = require('../models/Agendamiento');
const ConfigHorario = require('../models/ConfigHorario');
const { getDisponibilidadAgendamiento } = require('../services/configVisualService');

const ZONA = 'America/Costa_Rica';
const DOW_ES = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];

function hhmmToMinutes(hhmm='21:00'){ const [h,m] = hhmm.split(':').map(Number); return (h||0)*60 + (m||0); }
function canonSexo(x){
  const s = (x||'').toString().trim().toLowerCase();
  if (['m','masc','masculino','h','hombre','male','man'].includes(s)) return 'M';
  if (['f','fem','femenino','mujer','female','woman'].includes(s))   return 'F';
  return null;
}

async function fechaActiva() {
  const now = dayjs().tz(ZONA);
  const cutoff = await getDisponibilidadAgendamiento('21:00');
  const target = (now.hour()*60 + now.minute()) >= hhmmToMinutes(cutoff) ? now.add(1,'day') : now;
  return {
    fechaISO: target.format('YYYY-MM-DD'),
    fechaMidnight: target.startOf('day').toDate(),
    diaNombre: DOW_ES[target.day()]
  };
}

// GET /api/agendamientoRT/activa
exports.activa = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const sexoCanon = canonSexo(req.usuario.sexo || req.usuario.genero); // 'M'|'F'
    const { fechaISO, fechaMidnight, diaNombre } = await fechaActiva();

    const horarios = await ConfigHorario.find({ dia: diaNombre }).sort({ hInicio: 1 }).lean();
    const ids = horarios.map(h => h._id);

    const ocupacion = await Agendamiento.aggregate([
      { $match: { fecha: fechaMidnight, idConfigHorario: { $in: ids } } },
      { $lookup: { from: 'usuarios', localField: 'idUsuario', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $addFields: { _sx: { $toLower: { $ifNull: ['$u.sexo', '$u.genero'] } } } },
      { $group: {
          _id: '$idConfigHorario',
          hombres: { $sum: { $cond: [ { $in: ['$_sx', ['m','masculino','h','hombre','male']] }, 1, 0 ] } },
          // ❗ quitar 'm' (ambiguo). Solo 'f'/'femenino'/'mujer'/'female'
          mujeres: { $sum: { $cond: [ { $in: ['$_sx', ['f','femenino','mujer','female']] }, 1, 0 ] } },
          usuarios: { $addToSet: '$idUsuario' }
      } }
    ]);
    const mapO = new Map(ocupacion.map(o => [String(o._id), o]));

    const data = horarios.map(h => {
      const o = mapO.get(String(h._id));
      const insH = o?.hombres || 0;
      const insM = o?.mujeres || 0;
      const libresH = Math.max(0, (h.cupoHombres||0) - insH);
      const libresM = Math.max(0, (h.cupoMujeres||0) - insM);
      const yoReservado = !!(o?.usuarios || []).some(u => String(u) === String(usuarioId));
      return {
        horarioId: String(h._id),
        dia: h.dia,
        hInicio: h.hInicio,
        hFin: h.hFin,
        cupoHombres: h.cupoHombres || 0,
        cupoMujeres: h.cupoMujeres || 0,
        inscritosHombres: insH,
        inscritosMujeres: insM,
        libresHombres: libresH,
        libresMujeres: libresM,
        yoReservado
      };
    });

    res.json({ ok:true, fechaISO, dia: diaNombre, miGenero: sexoCanon, data });
  } catch (err) {
    res.status(500).json({ ok:false, mensaje:'Error al obtener agenda activa', detalle: err.message });
  }
};
