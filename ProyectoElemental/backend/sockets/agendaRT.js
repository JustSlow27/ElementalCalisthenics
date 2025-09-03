// backend/sockets/agendaRT.js
const jwt = require('jsonwebtoken');
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
function parseHHMM(hhmm='21:00'){ const [h,m] = hhmm.split(':').map(Number); return { h: h||0, m: m||0 }; }
function cutoffDateFor(fechaISO, hhmm='21:00') {
  const { h, m } = parseHHMM(hhmm);
  return dayjs.tz(fechaISO, ZONA).hour(h).minute(m).second(0).millisecond(0).toDate();
}
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
    cutoff, // HH:mm
    fechaISO: target.format('YYYY-MM-DD'),
    fechaMidnight: target.startOf('day').toDate(),
    diaNombre: DOW_ES[target.day()],
  };
}
async function recount(fechaMidnight, horarioId) {
  return (await Agendamiento.aggregate([
    { $match: { fecha: fechaMidnight, idConfigHorario: new mongoose.Types.ObjectId(horarioId) } },
    { $lookup: { from: 'usuarios', localField: 'idUsuario', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $addFields: { _sx: { $toLower: { $ifNull: ['$u.sexo', '$u.genero'] } } } },
    { $group: {
        _id: null,
        hombres: { $sum: { $cond: [ { $in: ['$_sx', ['m','masculino','h','hombre','male']] }, 1, 0 ] } },
        // Ojo: sin 'm' en mujeres (era ambiguo)
        mujeres: { $sum: { $cond: [ { $in: ['$_sx', ['f','femenino','mujer','female']] }, 1, 0 ] } }
    } }
  ]))[0] || { hombres:0, mujeres:0 };
}

module.exports = function attachAgendaSockets(io) {
  // Auth con token del login (mismo JWT)
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id: decoded.id,
        rol: decoded.rol || null,
        nombre: decoded.nombre || null,
        sexo: decoded.sexo || decoded.genero || null,
        sexoCanon: canonSexo(decoded.sexo || decoded.genero)
      };
      if (!socket.user.id) return next(new Error('Token inválido'));
      next();
    } catch (e) { next(new Error('Auth error')); }
  });

  // (Opcional) Rollover en vivo cerca del cutoff
  (async function scheduleRollover() {
    let lastKey = null;
    setInterval(async () => {
      try {
        const now = dayjs().tz(ZONA);
        const cutoff = await getDisponibilidadAgendamiento('21:00');
        const key = now.format('YYYY-MM-DD') + '|' + cutoff;
        const { h, m } = parseHHMM(cutoff);
        const at = now.hour(h).minute(m).second(0).millisecond(0);
        if (now.isAfter(at) && now.diff(at, 'seconds') <= 10 && key !== lastKey) {
          lastKey = key;
          const fechaISO = now.add(1,'day').format('YYYY-MM-DD');
          io.emit('agenda:rollover', { fechaISO });
        }
      } catch {}
    }, 20000);
  })();

  io.on('connection', (socket) => {
    socket.on('agenda:join', ({ fechaISO }) => {
      if (typeof fechaISO === 'string' && fechaISO.length === 10) {
        socket.join(`agenda:${fechaISO}`);
      }
    });

    // ==== RESERVAR (guarda en Mongo) ====
    socket.on('agenda:reservar', async ({ horarioId }, ack) => {
      const cb = typeof ack === 'function' ? ack : ()=>{};
      try {
        if (!horarioId) return cb({ ok:false, mensaje:'Falta horarioId' });
        if (!socket.user?.id) return cb({ ok:false, mensaje:'Sin usuario' });
        if (!socket.user?.sexoCanon) return cb({ ok:false, mensaje:'Usuario sin sexo' });

        const { fechaISO, fechaMidnight, cutoff } = await fechaActiva();
        const h = await ConfigHorario.findById(horarioId).lean();
        if (!h) return cb({ ok:false, mensaje:'Horario no encontrado' });

        const ya = await Agendamiento.findOne({ fecha: fechaMidnight, idConfigHorario: horarioId, idUsuario: socket.user.id });
        if (ya) return cb({ ok:false, mensaje:'Ya tienes una reserva en este horario' });

        // Guardar con TTL
        const expiresAt = cutoffDateFor(fechaISO, cutoff);
        const nuevo = await Agendamiento.create({
          idConfigHorario: horarioId,
          idUsuario: socket.user.id,
          fecha: fechaMidnight,
          expiresAt
        });

        // Recuento después de insertar (control de concurrencia)
        const { hombres:insH, mujeres:insM } = await recount(fechaMidnight, horarioId);
        let overflow = false;
        if (socket.user.sexoCanon === 'M' && insH > (h.cupoHombres||0)) overflow = true;
        if (socket.user.sexoCanon === 'F' && insM > (h.cupoMujeres||0)) overflow = true;
        if (overflow) {
          await Agendamiento.deleteOne({ _id: nuevo._id });
          return cb({ ok:false, mensaje:'Cupo agotado por concurrencia' });
        }

        io.to(`agenda:${fechaISO}`).emit('agenda:update', {
          fechaISO,
          horarioId: String(horarioId),
          libresHombres: Math.max(0, (h.cupoHombres||0) - insH),
          libresMujeres: Math.max(0, (h.cupoMujeres||0) - insM),
        });

        cb({ ok:true, mensaje:'Reservado' });
      } catch (err) {
        if (err?.code === 11000) return cb({ ok:false, mensaje:'Duplicado' });
        cb({ ok:false, mensaje: err.message || 'Error al reservar' });
      }
    });

    // ==== CANCELAR (borra de Mongo) ====
    socket.on('agenda:cancelar', async ({ horarioId }, ack) => {
      const cb = typeof ack === 'function' ? ack : ()=>{};
      try {
        if (!horarioId) return cb({ ok:false, mensaje:'Falta horarioId' });
        if (!socket.user?.id) return cb({ ok:false, mensaje:'Sin usuario' });

        const { fechaISO, fechaMidnight } = await fechaActiva();
        const del = await Agendamiento.deleteOne({ fecha: fechaMidnight, idConfigHorario: horarioId, idUsuario: socket.user.id });
        if (del.deletedCount === 0) return cb({ ok:false, mensaje:'No tenías reserva aquí' });

        const h = await ConfigHorario.findById(horarioId).lean();
        const { hombres:insH, mujeres:insM } = await recount(fechaMidnight, horarioId);

        io.to(`agenda:${fechaISO}`).emit('agenda:update', {
          fechaISO,
          horarioId: String(horarioId),
          libresHombres: Math.max(0, (h.cupoHombres||0) - insH),
          libresMujeres: Math.max(0, (h.cupoMujeres||0) - insM),
        });

        cb({ ok:true, mensaje:'Cancelado' });
      } catch (err) {
        cb({ ok:false, mensaje: err.message || 'Error al cancelar' });
      }
    });
  });
};
