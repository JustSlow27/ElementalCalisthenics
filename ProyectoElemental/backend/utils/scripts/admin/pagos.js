// utils/scripts/admin/pagos.js
(() => {
  const API_BASE = 'http://3.149.75.175:80/api';
  const token = localStorage.getItem('token');

  if (!token) {
    alert('⚠️ Sesión expirada. Inicia sesión de nuevo.');
    window.location.href = '../../login.html';
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Referencias UI
  const tbody = document.querySelector('#tablaPagos tbody');
  const buscador = document.getElementById('buscadorPagos');
  const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
  const searchBox = document.querySelector('.search-box');

  const selMes = document.getElementById('mesFiltro');
  const inAnio = document.getElementById('anioFiltro');
  const btnFiltrarFecha = document.getElementById('btnFiltrarFecha');

  // Estado de vista
  // 'pendientes' => lista sólo pendientes
  // 'historico'  => lista pagados por mes/año (y permite revertir)
  let modoVista = 'pendientes';
  let ultimoFiltroFecha = null; // { mes, anio, nombre }

  // Helpers
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtFecha = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  };
  function toast(msg, ok = true) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);
      background:${ok ? '#111827' : '#991b1b'};color:#fff;padding:10px 14px;border-radius:12px;
      opacity:0;transition:.25s;z-index:1000;font-size:.95rem;
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = 1; el.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translateX(-50%) translateY(20px)'; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }
  function estadoBadge(estado) {
    const e = (estado || 'pendiente').toLowerCase();
    const map = { pagado: '#059669', pendiente: '#9ca3af' };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;color:#fff;background:${map[e] || '#9ca3af'};font-size:.8rem;">${e}</span>`;
  }
  const debounce = (fn, ms = 250) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // Autocomplete UI
  const sug = document.createElement('ul');
  sug.id = 'sugPagos';
  sug.style.cssText = `
    position:absolute; top:100%; left:0; right:0; margin-top:6px; max-height:220px; overflow:auto;
    background:#fff; border:1px solid #e5e7eb; border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,.08);
    list-style:none; padding:6px 0; z-index:100; display:none;
  `;
  if (searchBox) {
    searchBox.style.position = 'relative';
    searchBox.appendChild(sug);
  }

  // Datos
  let lista = [];

  // Render tabla
  function render(rows) {
    tbody.innerHTML = '';
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center;color:#64748b;padding:18px;">No hay pagos registrados.</td>`;
      tbody.appendChild(tr);
      return;
    }

    const hoy = new Date();
    const fechaHoy = `${pad2(hoy.getDate())}/${pad2(hoy.getMonth() + 1)}/${hoy.getFullYear()}`;

    rows.forEach(p => {
      const tr = document.createElement('tr');
      tr.dataset.id = p._id;

      // Si está pendiente, fecha visual = hoy; si está pagado, fechaPago
      const fechaMostrar = (p.estado === 'pendiente')
        ? fechaHoy
        : (p.fechaPago ? fmtFecha(p.fechaPago) : '—');

      let accionesHTML = '';
      if (p.estado === 'pendiente') {
        accionesHTML = `<button class="btn-primary btn-aprobar">Marcar pagado</button>`;
      } else {
        // En histórico de pagados, permitir revertir
        accionesHTML = `
          ${p.aprobadoPor ? `<div style="margin-bottom:6px;">Aprobado por: ${p.aprobadoPor}</div>` : ''}
          <button class="btn-secondary btn-revertir">Revertir a pendiente</button>
        `;
      }

      tr.innerHTML = `
        <td>${p.usuario || '—'}</td>
        <td>${estadoBadge(p.estado)}</td>
        <td>${fechaMostrar}</td>
        <td>
          ${p.estado === 'pendiente'
            ? `<input class="obs" type="text" placeholder="Observación (opcional)" style="width:220px;" />`
            : (p.observaciones || '—')}
        </td>
        <td>${accionesHTML}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Cargar pendientes (default)
  async function cargarPendientes() {
    try {
      const res = await fetch(`${API_BASE}/pagos?estado=pendiente`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudieron cargar los pagos');
      lista = data.data || [];
      modoVista = 'pendientes';
      render(lista);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error cargando pagos', false);
    }
  }

  // Buscar pendientes por nombre
  async function buscarPorNombrePendiente(nombre) {
    try {
      const url = `${API_BASE}/pagos/buscar?estado=pendiente&nombre=${encodeURIComponent(nombre || '')}`;
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo filtrar pagos');
      lista = data.data || [];
      modoVista = 'pendientes';
      render(lista);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al filtrar', false);
    }
  }

  // Histórico: filtrar pagados por mes/año (+ nombre opcional)
  async function filtrarPorFecha({ mes, anio, nombre = '' }) {
    try {
      const params = new URLSearchParams({
        anio: String(anio),
        mes: String(mes),
      });
      if (nombre) params.set('nombre', nombre);

      const url = `${API_BASE}/pagos/por-fecha?${params.toString()}`;
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo cargar histórico');

      lista = data.data || [];
      modoVista = 'historico';
      ultimoFiltroFecha = { mes, anio, nombre };
      render(lista);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al cargar histórico', false);
    }
  }

  // Limpiar filtro a pendientes
  function clearFiltro() {
    if (buscador) buscador.value = '';
    sug.style.display = 'none';
    sug.innerHTML = '';
    modoVista = 'pendientes';
    ultimoFiltroFecha = null;
    cargarPendientes();
  }

  // Autocomplete (sólo en modo pendientes)
  async function cargarSugerencias(q) {
    if (modoVista !== 'pendientes') { sug.style.display = 'none'; sug.innerHTML = ''; return; }
    if (!q || q.trim().length < 2) { sug.style.display = 'none'; sug.innerHTML = ''; return; }
    try {
      const url = `${API_BASE}/pagos/autocomplete?estado=pendiente&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'Autocomplete falló');

      const nombres = data.data || [];
      if (!nombres.length) { sug.style.display = 'none'; sug.innerHTML = ''; return; }

      sug.innerHTML = nombres.map(n => `<li class="sug-item" style="padding:8px 12px; cursor:pointer;">${n}</li>`).join('');
      sug.style.display = 'block';
    } catch (err) {
      console.error(err);
    }
  }

  // === NUEVO: debounce para refiltrar histórico mientras escribes ===
  const refiltrarHistoricoDeb = debounce((q) => {
    if (!ultimoFiltroFecha) return;
    filtrarPorFecha({ ...ultimoFiltroFecha, nombre: q.trim() });
  }, 250);

  // Listeners: buscador
  if (buscador) {
    buscador.addEventListener('input', (e) => {
      const q = e.target.value;

      if (q.trim().length === 0) {
        // Si se borra con teclado → si estamos en histórico, re-ejecuta el histórico sin nombre.
        if (modoVista === 'historico' && ultimoFiltroFecha) {
          filtrarPorFecha({ ...ultimoFiltroFecha, nombre: '' });
        } else {
          // pendientes
          sug.style.display = 'none';
          sug.innerHTML = '';
          clearFiltro();
        }
        return;
      }

      if (modoVista === 'pendientes') {
        cargarSugerencias(q);
      } else {
        // En histórico: no hay sugerencias; refiltra por nombre con debounce
        sug.style.display = 'none';
        sug.innerHTML = '';
        refiltrarHistoricoDeb(q);
      }
    });

    buscador.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = (buscador.value || '').trim();

        if (modoVista === 'historico' && ultimoFiltroFecha) {
          filtrarPorFecha({ ...ultimoFiltroFecha, nombre: q });
        } else {
          if (q.length === 0) {
            clearFiltro();
          } else {
            sug.style.display = 'none';
            buscarPorNombrePendiente(q);
          }
        }
      }
    });
  }

  // Sugerencias click
  sug.addEventListener('click', (e) => {
    const li = e.target.closest('.sug-item');
    if (!li) return;
    if (buscador) buscador.value = li.textContent;
    sug.style.display = 'none';
    buscarPorNombrePendiente(li.textContent);
  });

  // Cerrar sugerencias al hacer click fuera
  document.addEventListener('click', (e) => {
    if (searchBox && !searchBox.contains(e.target)) {
      sug.style.display = 'none';
    }
  });

  // Botón limpiar
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', clearFiltro);
  }

  // Botón "Buscar mes" (histórico)
  if (btnFiltrarFecha && selMes && inAnio) {
    // Default: mes y año actuales
    const hoy = new Date();
    selMes.value = String(hoy.getMonth() + 1);
    inAnio.value = String(hoy.getFullYear());

    btnFiltrarFecha.addEventListener('click', () => {
      const mes = parseInt(selMes.value, 10);
      const anio = parseInt(inAnio.value, 10);
      const nombre = (buscador?.value || '').trim();

      if (!mes || !anio) {
        toast('Selecciona mes y año', false);
        return;
      }
      filtrarPorFecha({ mes, anio, nombre });
    });
  }

  // Delegación: marcar pagado / revertir
  tbody.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const id = tr.dataset.id;

    // Marcar pagado (desde pendientes)
    if (e.target.classList.contains('btn-aprobar')) {
      try {
        e.target.disabled = true;
        const obs = tr.querySelector('.obs')?.value || undefined;

        const res = await fetch(`${API_BASE}/pagos/${id}/pagar`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ observaciones: obs })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo marcar como pagado');

        toast('Pago marcado como PAGADO ✅');
        // Si estamos en pendientes, recarga pendientes
        cargarPendientes();
      } catch (err) {
        console.error(err);
        toast(err.message || 'Error al marcar pago', false);
      }
      return;
    }

    // Revertir a pendiente (desde histórico pagados)
    if (e.target.classList.contains('btn-revertir')) {
      try {
        e.target.disabled = true;
        const res = await fetch(`${API_BASE}/pagos/${id}/estado`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ estado: 'pendiente' })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo revertir');

        toast('Pago revertido a PENDIENTE 🔄');
        // Si estamos en histórico, vuelve a cargar el filtro actual; si no, pendientes
        if (modoVista === 'historico' && ultimoFiltroFecha) {
          filtrarPorFecha(ultimoFiltroFecha);
        } else {
          cargarPendientes();
        }
      } catch (err) {
        console.error(err);
        toast(err.message || 'Error al revertir', false);
      }
      return;
    }
  });

  // Init: cargar pendientes
  cargarPendientes();
})();
