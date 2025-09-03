// routes/configuracionVisualRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');

const ctrl = require('../controllers/configuracionVisualController');
const { proteger, autorizarRoles } = require('../middleware/authMiddleware');

// Multer -> uploads/logos
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(__dirname, '..', 'uploads', 'logos')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'logo_' + Date.now() + ext);
  }
});
const fileFilter = (_req, file, cb) => {
  const ok = /image\/(png|jpe?g|webp|gif|svg\+xml)/.test(file.mimetype);
  cb(ok ? null : new Error('Solo imágenes'), ok);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', ctrl.obtenerActual);
router.get('/:id', ctrl.obtenerPorId);

router.get('/admin/all/list', proteger, autorizarRoles('admin'), ctrl.listar);
router.post('/', proteger, autorizarRoles('admin'), ctrl.crear);
router.put('/:id', proteger, autorizarRoles('admin'), ctrl.actualizar);
router.patch('/:id', proteger, autorizarRoles('admin'), ctrl.actualizarParcial);
router.patch('/:id/colors', proteger, autorizarRoles('admin'), ctrl.actualizarColores);
router.post('/:id/logo', proteger, autorizarRoles('admin'), upload.single('logo'), ctrl.subirLogo);
router.delete('/:id', proteger, autorizarRoles('admin'), ctrl.eliminar);

module.exports = router;
