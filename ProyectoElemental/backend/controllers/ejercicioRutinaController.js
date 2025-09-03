// controllers/ejercicioRutinaController.js
const EjercicioRutina = require('../models/EjercicioRutina');
/*
exports.agregarEjercicioARutina = async (req, res) => {
  try {
    const { ejercicioId, rutinaId, reps } = req.body;

    if (!ejercicioId || !rutinaId) {
      return res.status(400).json({ mensaje: "Faltan datos: ejercicioId o rutinaId" });
    }

    const nuevo = new EjercicioRutina({ ejercicioId, rutinaId, reps });
    await nuevo.save();

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("❌ Error al agregar ejercicio a rutina:", error);
    res.status(500).json({ mensaje: "Error en el servidor" });
  }
};*/
