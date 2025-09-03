const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ejercicioController');
const { proteger, autorizarRoles } = require('../middleware/authMiddleware');

// Autocompletar (admin, entrenador)
router.get(
  '/autocomplete',
  proteger,
  autorizarRoles('entrenador', 'admin'),
  ctrl.buscarNombres
);

// Crear (admin, entrenador)
router.post('/', proteger, autorizarRoles('admin', 'entrenador'), ctrl.crearEjercicio);

// Listar (admin, entrenador)
router.get('/', proteger, autorizarRoles('admin', 'entrenador'), ctrl.listar);

// Obtener por ID (admin, entrenador)
router.get('/:id', proteger, autorizarRoles('admin', 'entrenador'), ctrl.obtener);

// Actualizar (admin, entrenador)
router.put('/:id', proteger, autorizarRoles('admin', 'entrenador'), ctrl.actualizar);
router.patch('/:id', proteger, autorizarRoles('admin', 'entrenador'), ctrl.actualizar);

// Eliminar (admin, entrenador)
router.delete('/:id', proteger, autorizarRoles('admin', 'entrenador'), ctrl.eliminar);

module.exports = router;
