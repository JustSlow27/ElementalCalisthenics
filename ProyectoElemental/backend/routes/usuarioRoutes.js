const express = require('express');
const router = express.Router();
const { proteger, autorizarRoles } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/usuarioController');

router.get('/usuarios', proteger, autorizarRoles('admin'), ctrl.obtenerUsuarios);
router.get('/usuarios/pendientes', proteger, autorizarRoles('admin'), ctrl.obtenerPendientes);
router.get('/usuarios/filtrar', proteger, autorizarRoles('admin'), ctrl.filtrarUsuarios);
router.patch('/usuarios/:id/rol', proteger, autorizarRoles('admin'), ctrl.asignarRol);
router.delete('/usuarios/:id', proteger, autorizarRoles('admin'), ctrl.eliminarUsuario);

module.exports = router;
