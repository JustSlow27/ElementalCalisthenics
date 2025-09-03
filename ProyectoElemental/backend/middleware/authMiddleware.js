const jwt = require('jsonwebtoken');

// 🔐 Middleware para proteger rutas
const proteger = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ mensaje: "No autorizado, falta token" });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Guardar usuario en req
    req.usuario = {
      id: decoded.id,
      rol: decoded.rol,
      nombre: decoded.nombre,
      sexo: decoded.sexo,
    };

    console.log("🔐 proteger() -> Header recibido:", auth);
    console.log("🔑 Payload JWT recibido:", decoded);

    next();
  } catch (err) {
    console.error("🚨 Error en proteger:", err);
    res.status(401).json({ mensaje: "Token no válido" });
  }
};

// 👮 Middleware para roles
const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    const rolUsuario = (req.usuario?.rol || "").toLowerCase().trim();
    const rolesNormalizados = rolesPermitidos.map(r => r.toLowerCase().trim());

    console.log(`👮 autorizarRoles() -> Rol detectado: "${rolUsuario}" | Roles permitidos: [${rolesNormalizados}]`);

    if (!rolesNormalizados.includes(rolUsuario)) {
      console.log("⛔ BLOQUEADO: Usuario no tiene permiso");
      return res.status(403).json({ mensaje: 'No tienes permiso para acceder a esta ruta' });
    }

    console.log("✅ ACCESO PERMITIDO");
    next();
  };
};

module.exports = { proteger, autorizarRoles };
