// services/configVisualService.js
const ConfigVisual = require('../models/ConfiguracionVisual');

const HHMM = /^\d{2}:\d{2}$/;

async function getDisponibilidadAgendamiento(defaultHHMM = '21:00') {
  const doc = await ConfigVisual.findOne().sort({ createdAt: -1 }).lean();
  const hhmm = doc?.disponibilidadAgendamiento;
  return HHMM.test(hhmm || '') ? hhmm : defaultHHMM;
}

module.exports = { getDisponibilidadAgendamiento };
