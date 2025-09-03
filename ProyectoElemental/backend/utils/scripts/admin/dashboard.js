// utils/scripts/admin/dashboard.js
(() => {
  // --- Filtro de ejercicios (expuesto globalmente para onkeyup del input) ---
  window.filterList = function () {
    const input = document.getElementById('searchInput');
    if (!input) return;

    // Búsqueda sin acentos y case-insensitive
    const term = input.value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();

    const items = document.querySelectorAll('#exerciseList li');
    items.forEach(li => {
      const txt = (li.textContent || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
      li.style.display = txt.includes(term) ? '' : 'none';
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const nombre = localStorage.getItem('nombreUsuario');
    const token  = localStorage.getItem('token');

    // Verificación de sesión
    if (!token || !nombre) {
      window.location.href = '../../login.html';
      return;
    }

    // Mostrar nombre en el header
    const nombreEl = document.getElementById('nombreUsuario');
    if (nombreEl) nombreEl.textContent = `👤 ${nombre}`;

    // Botón Salir
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('nombreUsuario');
        window.location.href = '../login.html';
      });
    }

    // ---------- Carga de configuración visual protegida ----------
    try {
      const res = await fetch('http://3.149.75.175:80/api/configuracion-visual', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const raw = await res.json().catch(() => ({}));

      // Soporta ambas formas: { colorPrimario... } o { data: { ... } }
      const cfg = (raw && typeof raw === 'object' && raw.data) ? raw.data : raw;

      if (cfg && typeof cfg === 'object') {
        if (cfg.colorPrimario)  document.documentElement.style.setProperty('--color-primario',  cfg.colorPrimario);
        if (cfg.colorSecundario)document.documentElement.style.setProperty('--color-secundario',cfg.colorSecundario);
        if (cfg.colorBotones)   document.documentElement.style.setProperty('--color-botones',   cfg.colorBotones);

        // Logo
        const logoImg = document.getElementById('logoImg');
        const logoURL = cfg.logoURL ? `http://3.149.75.175:80${cfg.logoURL}` : (cfg.logo || '');
        if (logoImg && logoURL) {
          logoImg.src = `${logoURL}?t=${Date.now()}`; // evita caché
          logoImg.alt = cfg.nombreGimnasio || 'Logo del gimnasio';
        }

        // Nombre del gimnasio
        const gymEl = document.getElementById('nombreGimnasio');
        if (gymEl && (cfg.nombreGimnasio || cfg.nombreGym)) {
          gymEl.textContent = cfg.nombreGimnasio || cfg.nombreGym;
        }
      }
    } catch (err) {
      console.error('Error al aplicar configuración visual:', err);
    }

    // ---------- Botón "Limpiar" del buscador ----------
    const btnClear    = document.getElementById('btnClearSearch'); // Debe existir en el HTML
    const searchInput = document.getElementById('searchInput');

    if (btnClear && searchInput) {
      btnClear.addEventListener('click', () => {
        searchInput.value = '';
        window.filterList(); // restaura la lista
        searchInput.focus();
      });

      // Atajo: ESC limpia el buscador
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          window.filterList();
        }
      });
    }
  });
})();
