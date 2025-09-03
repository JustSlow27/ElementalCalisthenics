const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/agendamientoRTController');
const { proteger, autorizarRoles} = require('../middleware/authMiddleware');

router.get('/activa', proteger,autorizarRoles ('cliente'), ctrl.activa);


module.exports = router;
