/*// routes/ejercicioRutinaRoutes.js
const express = require('express');
const router = express.Router();
const { proteger, autorizarRoles } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/ejercicioRutinaController');

// Solo entrenadores pueden agregar ejercicios a una rutina
router.post('/', proteger, autorizarRoles('entrenador'), ctrl.agregarEjercicioARutina);

module.exports = router;
*/