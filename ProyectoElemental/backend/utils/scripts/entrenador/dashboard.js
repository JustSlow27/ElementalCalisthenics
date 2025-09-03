document.addEventListener('DOMContentLoaded', () => {
  const $  = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

  // ==== API & Auth ====
  const API_BASE        = 'http://localhost:4000/api';
  const API_EJERCICIOS  = `${API_BASE}/ejercicios/autocomplete`; // GET ?search=
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Sesión expirada. Inicia sesión de nuevo.');
    window.location.href = '../../login.html';
    return;
  }
  const AUTH_HEADERS = { Authorization: `Bearer ${token}` };

  // ---- DOM base
  const tabla      = $("#tablaRutina");
  const thead      = $("#tablaRutina thead");
  const tbody      = $("#tablaRutina tbody");
  const selDias    = $("#diasRutina");
  const chipsGroup = $("#diasChips");
  const btnAdd          = $("#btnAgregarFila");
  const btnEliminarFila = $("#btnEliminarFila");
  const btnLimpiar      = $("#btnLimpiar");
  const lblEstado  = $("#estadoGuardado");
  const spin       = lblEstado?.querySelector?.(".spin");
  const msg        = lblEstado?.querySelector?.(".msg");

  // ---- Config
  const EJ_WIDTH   = 200;
  const REPS_WIDTH = 100;
  const FILAS_INICIALES = 6;

  const MIN_CHARS   = 2;
  const DEBOUNCE_MS = 200;
  const timers      = new WeakMap();
  const controllers = new WeakMap();

  const cap     = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  const diasSel = () => selDias ? Array.from(selDias.selectedOptions).map(o => o.value) : [];

  // ======================= UTIL =======================
  function limpiarTabla() {
    if (!thead || !tbody || !tabla) return;
    thead.innerHTML = "";
    tbody.innerHTML = "";
    tabla.style.minWidth = "800px";
    updateEliminarHabilitado();
  }
  function setEstado(texto = "", modo = "idle") {
    if (!lblEstado || !msg) return;
    msg.textContent = texto || "";
    if (modo === "loading") {
      if (spin) spin.hidden = false; lblEstado.style.color = "var(--text)";
    } else if (modo === "ok") {
      if (spin) spin.hidden = true;  lblEstado.style.color = "green";
    } else if (modo === "error") {
      if (spin) spin.hidden = true;  lblEstado.style.color = "#dc2626";
    } else {
      if (spin) spin.hidden = true;  lblEstado.style.color = "inherit";
    }
  }
  if (spin) {
    Object.assign(spin.style, {
      display: "inline-block", width: "16px", height: "16px",
      border: "2px solid rgba(0,0,0,.12)", borderTopColor: "var(--color-primario)",
      borderRadius: "50%", marginRight: "8px", animation: "spin .8s linear infinite",
    });
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  function updateEliminarHabilitado() {
    if (!btnEliminarFila || !tbody) return;
    const tieneFilas = !!tbody?.rows.length;
    btnEliminarFila.disabled = !tieneFilas;
  }

  // ======================= CHIPS ↔ SELECT =======================
  function syncSelectFromChips() {
    if (!chipsGroup || !selDias) return;
    const activos = new Set(
      $$(".chip[aria-pressed='true']", chipsGroup)
        .filter(b => !b.disabled)
        .map(b => b.dataset.value)
    );
    Array.from(selDias.options).forEach(o => { o.selected = activos.has(o.value); });
  }

  function toggleChip(btn) {
    if (!btn || btn.disabled) return; // respetar chips bloqueados
    const on = btn.getAttribute("aria-pressed") === "true";
    btn.setAttribute("aria-pressed", on ? "false" : "true");
    syncSelectFromChips();
    selDias?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (chipsGroup) {
    $$(".chip", chipsGroup).forEach(btn => btn.setAttribute("aria-pressed", "false"));
    syncSelectFromChips();

    chipsGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (btn) toggleChip(btn);
    });
    chipsGroup.addEventListener("keydown", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleChip(btn);
      }
    });
  }

  // ======================= RENDER (sólo tabla vacía para crear nuevas) =======================
  function renderTabla(dias, filas = FILAS_INICIALES) {
    if (!tabla || !thead || !tbody) return;
    if (!dias || !dias.length) { limpiarTabla(); return; }

    // colgroup (2 por día)
    let cols = "";
    dias.forEach(() => {
      cols += `<col style="width:${EJ_WIDTH}px">`;
      cols += `<col style="width:${REPS_WIDTH}px">`;
    });
    let cg = tabla.querySelector("colgroup");
    if (cg) cg.remove();
    cg = document.createElement("colgroup");
    cg.innerHTML = cols;
    tabla.insertBefore(cg, tabla.firstChild);

    // thead
    let filaDias = "<tr>";
    dias.forEach(d => { filaDias += `<th colspan="2">${cap(d)}</th>`; });
    filaDias += "</tr>";

    let filaEtiq = "<tr>";
    dias.forEach(() => { filaEtiq += `<th>Ejercicio</th><th>Reps</th>`; });
    filaEtiq += "</tr>";

    thead.innerHTML = filaDias + filaEtiq;

    // tbody
    tbody.innerHTML = "";
    for (let r = 0; r < filas; r++) {
      tbody.insertAdjacentHTML("beforeend", buildRowHTML(dias.length));
    }

    const anchoDias = dias.length * (EJ_WIDTH + REPS_WIDTH);
    tabla.style.minWidth = (anchoDias) + "px";

    updateEliminarHabilitado();
  }
  let rowCounter = 0;

  function buildRowHTML(numDias) {
    rowCounter++;
    let row = "<tr>";
    for (let i = 0; i < numDias; i++) {
      row += `
        <td class="ejercicio" style="position:relative">
          <input type="text" 
                 id="ejercicio-${rowCounter}-${i}" 
                 class="in-ejercicio" 
                 placeholder="Ejercicio" 
                 autocomplete="off">
          <ul class="sugerencias" style="display:none"></ul>
        </td>
        <td class="reps">
          <input type="text" 
                 id="reps-${rowCounter}-${i}" 
                 class="in-reps" 
                 placeholder="Reps" 
                 autocomplete="off">
        </td>
      `;
    }
    row += "</tr>";
    return row;
  }

  // ======================= AUTOCOMPLETE (ejercicio) =======================
  async function fetchEjercicios(q, signal) {
    const url = new URL(API_EJERCICIOS);
    url.searchParams.set('search', q);
    url.searchParams.set('limit', 8);
    const res = await fetch(url, { signal, headers: AUTH_HEADERS });
    if (!res.ok) {
      let errText = '';
      try { const j = await res.json(); errText = j.mensaje || j.error || ''; } catch {}
      if (res.status === 401 || res.status === 403) {
        throw new Error(`HTTP ${res.status} - No tienes permiso para esta acción`);
      }
      throw new Error(`HTTP ${res.status}${errText ? ' - ' + errText : ''}`);
    }
    return res.json(); // [{ _id, nombre }]
  }

  function renderSugerencias(ul, items) {
    if (!items?.length) { ul.style.display = "none"; ul.innerHTML = ""; return; }
    ul.innerHTML = items
      .map(ej => `<li data-id="${ej._id}" data-nombre="${ej.nombre}">${ej.nombre}</li>`)
      .join("");
    ul.style.display = "block";
  }

  function closeAllSuggests() { $$(".sugerencias").forEach(ul => ul.style.display = "none"); }

  // input → sugerencias (no tocamos dataset.id al escribir; así no se pierde el id)
  tbody?.addEventListener("input", (e) => {
    const input = e.target.closest(".in-ejercicio");
    if (!input) return;
    const ul = input.parentElement.querySelector(".sugerencias");
    const q  = input.value.trim();

    if (q.length < MIN_CHARS) { ul.style.display = "none"; ul.innerHTML = ""; return; }

    clearTimeout(timers.get(input));
    const t = setTimeout(async () => {
      controllers.get(input)?.abort?.();
      const ctrl = new AbortController();
      controllers.set(input, ctrl);
      try {
        const data = await fetchEjercicios(q, ctrl.signal);
        renderSugerencias(ul, data);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Autocomplete error:", err);
          ul.style.display = "none";
        }
      }
    }, DEBOUNCE_MS);
    timers.set(input, t);
  });

  // click sugerencia → fija id y también orig-id / orig-nombre
  tbody?.addEventListener("click", (e) => {
    const li = e.target.closest(".sugerencias li");
    if (!li) return;
    const td = li.closest("td.ejercicio");
    const input = td.querySelector(".in-ejercicio");

    if (input) {
      input.value = li.dataset.nombre;     // visible
      input.dataset.id = li.dataset.id;    // id actual
      input.dataset.origId = li.dataset.id;        // orig para restaurar si no cambia el nombre
      input.dataset.origNombre = li.dataset.nombre;
      input.focus();
    }
    li.parentElement.style.display = "none";
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#tablaRutina td.ejercicio")) closeAllSuggests();
  });

  // ======================= ACCIONES INICIALES =======================
  if (selDias) Array.from(selDias.options).forEach(o => o.selected = false);
  limpiarTabla();

  selDias?.addEventListener("change", () => {
    const dias = diasSel();
    if (!dias.length) { limpiarTabla(); setEstado("Selecciona días para crear la tabla.", "idle"); return; }
    renderTabla(dias, FILAS_INICIALES);
    setEstado("Tabla generada según días seleccionados.", "idle");
  });

  btnLimpiar?.addEventListener("click", () => {
    if (chipsGroup) {
      $$(".chip", chipsGroup).forEach(btn => btn.setAttribute("aria-pressed", "false"));
      syncSelectFromChips();
    } else if (selDias) {
      Array.from(selDias.options).forEach(o => o.selected = false);
    }
    limpiarTabla();
    setEstado("Limpiaste la tabla.", "idle");
  });

  // ======================= FILAS: evitar doble registro con rutina.js =======================
  function bindFilaHandlersDashboard() {
    if (window.__ROW_HANDLERS_BOUND__) return; // ya otro archivo tomó control
    window.__ROW_HANDLERS_BOUND__ = "dashboard";

    btnAdd?.addEventListener("click", () => {
      const nDias = diasSel().length;
      if (!nDias) { setEstado("Selecciona días antes de agregar filas.", "error"); return; }
      tbody.insertAdjacentHTML("beforeend", buildRowHTML(nDias));
      updateEliminarHabilitado();
    });

    btnEliminarFila?.addEventListener("click", () => {
      const filas = tbody?.rows.length || 0;
      if (!filas) return;

      const ultima = tbody.rows[filas - 1];
      const inputs = ultima.querySelectorAll("input.in-ejercicio, input.in-reps");
      const tieneDatos = Array.from(inputs).some(inp => {
        const v  = (inp.value || "").trim();
        const id = (inp.dataset?.id || "").trim();
        return v || id;
      });
      if (tieneDatos) {
        alert("⚠️ No puedes eliminar una fila con datos. Vacíala primero.");
        return;
      }
      tbody.deleteRow(filas - 1);
      updateEliminarHabilitado();
    });
  }
  bindFilaHandlersDashboard();
});
