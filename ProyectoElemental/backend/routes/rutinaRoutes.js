// rutas/rutinas.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/rutinaController');
const { proteger, autorizarRoles } = require('../middleware/authMiddleware');

router.post('/', proteger, autorizarRoles('entrenador'), ctrl.crearRutina);

router.get('/mia', proteger, autorizarRoles('cliente'), ctrl.obtenerRutinaSemana);
router.get('/por-semana', proteger, autorizarRoles('entrenador'), ctrl.obtenerRutinaPorSemana);

// 👉 Entrenador: editar rutina existente
router.put('/:id', proteger, autorizarRoles('entrenador'), ctrl.editarRutina);

// 👉 Entrenador: eliminar rutina
router.delete('/:id', proteger, autorizarRoles('entrenador'), ctrl.eliminarRutina);

module.exports = router;