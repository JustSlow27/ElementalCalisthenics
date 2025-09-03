document.addEventListener('DOMContentLoaded', async () => {
  const nombre = localStorage.getItem('nombreUsuario');
  const token = localStorage.getItem('token');

  // Verifica si hay token y nombre
  if (!token || !nombre) {
    window.location.href = '../../login.html';
    return;
  }

  // Mostrar nombre del usuario
  document.getElementById('nombreUsuario').textContent = `👤 ${nombre}`;

  // Botón salir
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nombreUsuario');
    window.location.href = '../login.html';
  });

  // Aplicar configuración visual
  try {
    const res = await fetch('http://localhost:4000/api/configuracion-visual', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const config = await res.json();

    if (config.colorPrimario) {
      document.documentElement.style.setProperty('--color-primario', config.colorPrimario);
    }

    if (config.colorSecundario) {
      document.documentElement.style.setProperty('--color-secundario', config.colorSecundario);
    }

    if (config.colorBotones) {
      document.documentElement.style.setProperty('--color-botones', config.colorBotones);
    }

    if (config.logoURL) {
      const logoImg = document.getElementById('logoImg');
      if (logoImg) {
        const timestamp = Date.now(); // Evita caché de navegador
        logoImg.src = `http://localhost:4000${config.logoURL}?t=${timestamp}`;
        logoImg.alt = config.nombreGimnasio || 'Logo del gimnasio';
      }
    }

    if (config.nombreGimnasio) {
      const nombreElem = document.getElementById('nombreGimnasio');
      if (nombreElem) {
        nombreElem.textContent = config.nombreGimnasio;
      }
    }

  } catch (err) {
    console.error('Error al aplicar configuración visual:', err);
  }
});
