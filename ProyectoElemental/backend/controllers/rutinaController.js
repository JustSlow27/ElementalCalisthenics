const Rutina = require('../models/Rutina');
const Ejercicio = require('../models/Ejercicio');
const EjercicioRutina = require('../models/EjercicioRutina');

// ✅ Función auxiliar para calcular semana ISO
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function canonSexo(valor) {
  const s = (valor || '').toString().trim().toLowerCase();
  if (['m','masc','masculino','h','hombre','male','man'].includes(s)) return 'masculino';
  if (['f','fem','femenino','mujer','female','woman'].includes(s))   return 'femenino';
  return s; // por si ya viene correcto
}

// 📌 Crear nueva rutina
exports.crearRutina = async (req, res) => {
  try {
    const { nombre, genero, semana, ejercicios } = req.body;

    if (!nombre || !genero || !semana) {
      return res.status(400).json({ mensaje: "Faltan datos" });
    }

    // 1️⃣ Crear rutina
    const nuevaRutina = await Rutina.create({ nombre, genero, semana });

    // 2️⃣ Insertar ejercicios
    if (ejercicios?.length) {
      const asociaciones = ejercicios.map(ej => ({
        ejercicioId: ej.ejercicioId,
        rutinaId: nuevaRutina._id,
        reps: ej.reps,
        dia: ej.dia
      }));
      await EjercicioRutina.insertMany(asociaciones);
    }

    res.status(201).json({ ok: true, rutina: nuevaRutina });
  } catch (err) {
    console.error("❌ Error en crearRutina:", err);
    res.status(500).json({ mensaje: "Error al guardar rutina" });
  }
};

// 📌 Cliente → ver rutina de la semana actual
exports.obtenerRutinaSemana = async (req, res) => {
  try {
    const sexoCanon = canonSexo(req.usuario?.sexo || req.usuario?.genero);
    if (!sexoCanon) {
      return res.status(400).json({ mensaje: "Tu usuario no tiene sexo definido" });
    }

    // Permite override con ?semana=NN para pruebas; si no, semana actual
    const semana = Number(req.query.semana) || getWeekNumber(new Date());

    // ✅ Compatibilidad: si en BD tienes rutinas guardadas como 'M'/'F' o
    // como 'masculino'/'femenino', buscamos SOLO el género correcto.
    const generoCompat = (sexoCanon === 'masculino')
      ? ['masculino', 'M', 'm']
      : ['femenino',  'F', 'f'];

    const rutina = await Rutina.findOne({ genero: { $in: generoCompat }, semana }).lean();
    if (!rutina) {
      return res.status(404).json({ mensaje: "No hay rutina creada para esta semana" });
    }

    const ejercicios = await EjercicioRutina.find({ rutinaId: rutina._id })
      .populate("ejercicioId", "nombre descripcion")
      .lean();

    // Agrupar por día (en minúscula para el front)
    const ejerciciosPorDia = {};
    for (const ej of ejercicios) {
      const dia = (ej.dia || '').toString().trim().toLowerCase();
      if (!ejerciciosPorDia[dia]) ejerciciosPorDia[dia] = [];
      ejerciciosPorDia[dia].push({
        nombre: ej.ejercicioId?.nombre || '',
        descripcion: ej.ejercicioId?.descripcion || '',
        reps: ej.reps ?? ''
      });
    }

    res.json({ ok: true, rutina, ejercicios: ejerciciosPorDia });
  } catch (err) {
    console.error("❌ Error en obtenerRutinaSemana:", err);
    res.status(500).json({ mensaje: "Error al cargar rutina semanal" });
  }
};
exports.obtenerRutinaPorSemana = async (req, res) => {
  try {
    const { genero, fecha } = req.query;
    if (!genero || !fecha) {
      return res.status(400).json({ mensaje: "Faltan datos: genero o fecha" });
    }

    const semana = getWeekNumber(new Date(fecha));

    const rutina = await Rutina.findOne({ genero, semana }).lean();
    if (!rutina) {
      return res.json({ rutina: null, ejercicios: {} }); // 👈 devolvemos vacío
    }

    const ejercicios = await EjercicioRutina.find({ rutinaId: rutina._id })
      .populate("ejercicioId", "nombre descripcion")
      .lean();

    // agrupar por día
    const ejerciciosPorDia = {};
    ejercicios.forEach(ej => {
      if (!ejerciciosPorDia[ej.dia]) ejerciciosPorDia[ej.dia] = [];
      ejerciciosPorDia[ej.dia].push({
        _id: ej.ejercicioId._id,
        nombre: ej.ejercicioId.nombre,
        descripcion: ej.ejercicioId.descripcion,
        reps: ej.reps
      });
    });

    res.json({ rutina, ejercicios: ejerciciosPorDia });
  } catch (err) {
    console.error("❌ Error en obtenerRutinaPorSemana:", err);
    res.status(500).json({ mensaje: "Error al cargar rutina semanal específica" });
  }
};
// 📌 Entrenador → editar rutina existente de una semana
exports.editarRutina = async (req, res) => {
  try {
    const { id } = req.params; // rutinaId
    const { nombre, genero, ejercicios } = req.body;

    const rutina = await Rutina.findById(id);
    if (!rutina) return res.status(404).json({ mensaje: "Rutina no encontrada" });

    // 1️⃣ Actualizar datos básicos
    if (nombre) rutina.nombre = nombre;
    if (genero) rutina.genero = genero;
    await rutina.save();

    // 2️⃣ Reemplazar ejercicios de esa rutina
    if (ejercicios) {
      await EjercicioRutina.deleteMany({ rutinaId: rutina._id });
      const asociaciones = ejercicios.map(ej => ({
        ejercicioId: ej.ejercicioId,
        rutinaId: rutina._id,
        reps: ej.reps,
        dia: ej.dia
      }));
      await EjercicioRutina.insertMany(asociaciones);
    }

    res.json({ ok: true, mensaje: "Rutina actualizada", rutina });
  } catch (err) {
    console.error("❌ Error en editarRutina:", err);
    res.status(500).json({ mensaje: "Error al editar rutina" });
  }
};

exports.eliminarRutina = async (req, res) => {
  try {
    const { id } = req.params;

    const rutina = await Rutina.findById(id);
    if (!rutina) return res.status(404).json({ mensaje: "Rutina no encontrada" });

    // Eliminar ejercicios asociados
    await EjercicioRutina.deleteMany({ rutinaId: rutina._id });

    // Eliminar rutina
    await Rutina.findByIdAndDelete(id);

    res.json({ ok: true, mensaje: "Rutina eliminada con éxito" });
  } catch (err) {
    console.error("❌ Error en eliminarRutina:", err);
    res.status(500).json({ mensaje: "Error al eliminar rutina" });
  }
};
