// routes/configHorario.routes.js
const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/configHorarioController');
const { proteger, autorizarRoles } = require('../middleware/authMiddleware');

router.post('/',proteger,autorizarRoles('admin'),ctrl.crear);
router.get('/',proteger,autorizarRoles('admin', 'clientes'),ctrl.listar);
router.get('/:id',proteger,autorizarRoles('admin'),ctrl.obtener);
router.put('/:id',proteger,autorizarRoles('admin'),ctrl.actualizar);
router.patch('/:id',proteger,autorizarRoles('admin'),ctrl.actualizar);
router.delete('/:id',proteger,autorizarRoles('admin'),ctrl.eliminar);

module.exports = router;
