const API_BASE = 'http://localhost:4000/api';
const token = localStorage.getItem('token');

if (!token) {
  alert('Sesión expirada. Inicia sesión de nuevo.');
  window.location.href = '../../login.html';
}

// DOM
const form = document.getElementById('configForm');
const inputNombre = document.getElementById('nombreGimnasio');
const inputPrimario = document.getElementById('colorPrimario');
const inputSecundario = document.getElementById('colorSecundario');
const inputBotones = document.getElementById('colorBotones');
const inputHora = document.getElementById('disponibilidadAgendamiento');
const inputLogo = document.getElementById('logo');
const divResultado = document.getElementById('resultado');

let currentConfigId = null;
let logoPreviewEl = null;

const authHeaders = () => ({ Authorization: `Bearer ${token}` });

function setThemeVars({ primario, secundario, botones }) {
  const root = document.documentElement;
  // 👇 Forzamos a aplicar aunque vengan vacíos (para depurar)
  if (primario  !== undefined) root.style.setProperty('--color-primario', primario  || '#2c3e50');
  if (secundario!== undefined) root.style.setProperty('--color-secundario', secundario|| '#34495e');
  if (botones   !== undefined) root.style.setProperty('--color-botones',  botones   || '#0066cc');
}

function showMsg(msg, ok = true) {
  divResultado.innerHTML = `<div style="margin-top:10px; padding:10px; border-radius:10px; 
    background:${ok ? '#ecfdf5' : '#fef2f2'}; color:${ok ? '#065f46' : '#991b1b'}; border:1px solid ${ok ? '#a7f3d0' : '#fecaca'};">
    ${msg}</div>`;
}

function ensureLogoPreview() {
  if (!logoPreviewEl) {
    logoPreviewEl = document.createElement('img');
    logoPreviewEl.id = 'logoPreview';
    logoPreviewEl.alt = 'Logo del gimnasio';
    logoPreviewEl.style.cssText = 'margin-top:12px; max-height:90px; border-radius:10px; border:1px solid #e5e7eb;';
    inputLogo.parentElement.appendChild(logoPreviewEl);
  }
}

// Cargar última configuración (pública)
async function cargarConfig() {
  try {
    const res = await fetch(`${API_BASE}/config-visual`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.mensaje || 'No se pudo obtener la configuración');

    const cfg = data.data;
    if (!cfg) {
      showMsg('No hay configuración previa. Crea una nueva.', true);
      return;
    }

    currentConfigId = cfg._id;

    inputNombre.value = cfg.nombreGym || '';
    inputPrimario.value = cfg.colorPrimario || '#2c3e50';
    inputSecundario.value = cfg.colorSecundario || '#34495e';
    inputBotones.value = cfg.colorBotones || '#0066cc'; // 👈
    inputHora.value = cfg.disponibilidadAgendamiento || '06:00';

    setThemeVars({
      primario: inputPrimario.value,
      secundario: inputSecundario.value,
      botones: inputBotones.value
    });

    if (cfg.logo) {
      ensureLogoPreview();
      logoPreviewEl.src = cfg.logo;
    }

    showMsg('Configuración cargada.', true);
  } catch (err) {
    console.error(err);
    showMsg(err.message || 'Error al cargar la configuración', false);
  }
}

// Guardar (crear/actualizar) + subir logo
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    nombreGym: inputNombre.value.trim(),
    colorPrimario: inputPrimario.value,
    colorSecundario: inputSecundario.value,
    colorBotones: inputBotones.value, // 👈
    disponibilidadAgendamiento: inputHora.value
  };

  try {
    let res, data;

    if (currentConfigId) {
      res = await fetch(`${API_BASE}/config-visual/${currentConfigId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${API_BASE}/config-visual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
    }

    data = await res.json();
    if (!res.ok || !data.ok) throw new Error((data.errores && data.errores.join(', ')) || data.mensaje || 'No se pudo guardar');

    const saved = data.data;
    currentConfigId = saved._id;

    if (inputLogo.files && inputLogo.files[0]) {
      await subirLogo(currentConfigId, inputLogo.files[0]);
    }

    setThemeVars({
      primario: payload.colorPrimario,
      secundario: payload.colorSecundario,
      botones: payload.colorBotones
    });

    showMsg('Configuración guardada correctamente ✅', true);
  } catch (err) {
    console.error(err);
    showMsg(err.message || 'Error al guardar', false);
  }
});

// Subir logo
async function subirLogo(id, file) {
  const fd = new FormData();
  fd.append('logo', file, file.name);

  const res = await fetch(`${API_BASE}/config-visual/${id}/logo`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd
  });

  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.mensaje || 'Error al subir el logo');

  ensureLogoPreview();
  logoPreviewEl.src = data.data.logo;
}

// Previsualización en vivo
inputPrimario.addEventListener('input', () => setThemeVars({ primario: inputPrimario.value }));
inputSecundario.addEventListener('input', () => setThemeVars({ secundario: inputSecundario.value }));
inputBotones.addEventListener('input', () => setThemeVars({ botones: inputBotones.value }));

// Preview local del logo
inputLogo.addEventListener('change', () => {
  const file = inputLogo.files?.[0];
  if (!file) return;
  ensureLogoPreview();
  const reader = new FileReader();
  reader.onload = (ev) => { logoPreviewEl.src = ev.target.result; };
  reader.readAsDataURL(file);
});

// Init
cargarConfig();
