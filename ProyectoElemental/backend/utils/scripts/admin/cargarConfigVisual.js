// utils/scripts/admin/cargarConfigVisual.js
(() => {
  const API_BASE = 'http://localhost:4000/api';

  async function cargarConfigVisualGlobal() {
    try {
      const res = await fetch(`${API_BASE}/config-visual`);
      const data = await res.json();
      if (!res.ok || !data.ok || !data.data) return;

      const cfg = data.data;
      const root = document.documentElement;
      root.style.setProperty('--color-primario',  cfg.colorPrimario  || '#2c3e50');
      root.style.setProperty('--color-secundario',cfg.colorSecundario|| '#34495e');
      root.style.setProperty('--color-botones',   cfg.colorBotones   || '#0066cc');

      const nombreEl = document.getElementById('nombreGimnasio');
      if (nombreEl && cfg.nombreGym) nombreEl.textContent = cfg.nombreGym;

      const logoEl = document.getElementById('logoImg');
      if (logoEl && cfg.logo) logoEl.src = cfg.logo;
    } catch (err) {
      console.error('Error cargando configuración visual global:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', cargarConfigVisualGlobal);
})();
