const express = require('express');
const router = express.Router();
const { proteger, autorizarRoles } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/pagoController');

// Solo admin puede gestionar pagos
router.get('/pagos', proteger, autorizarRoles('admin'), ctrl.listarPagos);
router.get('/pagos/buscar', proteger, autorizarRoles('admin'), ctrl.buscarPagos);
router.get('/pagos/autocomplete', proteger, autorizarRoles('admin'), ctrl.autocompleteNombresPendientes);

// Histórico por mes/año (mes completo, sin filtrar por estado)
router.get('/pagos/por-fecha', proteger, autorizarRoles('admin'), ctrl.listarPagosPorFecha);

// Cambiar estado (revertir o marcar pagado)
router.patch('/pagos/:id/estado', proteger, autorizarRoles('admin'), ctrl.actualizarEstadoPago);

router.patch('/pagos/:id/pagar', proteger, autorizarRoles('admin'), ctrl.marcarPagado);
router.post('/pagos/crear-pendiente/:usuarioId', proteger, autorizarRoles('admin'), ctrl.crearPendienteParaUsuario);

module.exports = router;
