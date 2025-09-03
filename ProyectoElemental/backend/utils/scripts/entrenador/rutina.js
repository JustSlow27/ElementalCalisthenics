document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://3.149.75.175:80/api/rutinas";
  const token = localStorage.getItem("token");

  if (!token) {
    alert("⚠️ Sesión expirada. Inicia sesión de nuevo.");
    window.location.href = "../../login.html";
    return;
  }

  const AUTH_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const btnGuardar  = document.getElementById("btnGuardarRutina");
  const inNombre    = document.getElementById("nombreRutina");
  const selGenero   = document.getElementById("generoRutina");
  const inFecha     = document.getElementById("fechaSemana");
  const tablaHead   = document.querySelector("#tablaRutina thead");
  const tablaBody   = document.querySelector("#tablaRutina tbody");
  const btnEliminar = document.getElementById("btnEliminarRutina");
  const btnAgregarFila  = document.getElementById("btnAgregarFila");
  const btnEliminarFila = document.getElementById("btnEliminarFila");

  // 🔖 LABEL de "Nombre" (usa el que tengas en tu HTML)
  // Ideal: <label for="nombreRutina">Nombre</label>
  // Fallback: si usas id propio como <label id="labelNombreRutina">Nombre</label>
  const labNombre =
    document.querySelector('label[for="nombreRutina"]') ||
    document.getElementById("labelNombreRutina");

  // Chips
  const chipsContainer = document.getElementById("diasChips");
  const chipsGroup     = chipsContainer ? chipsContainer.querySelectorAll(".chip") : [];
  const selDias        = document.getElementById("diasRutina");

  let rutinaActualId = null;

  // === CHIPS: visibilidad y bloqueo ===
  const CHIPS_DEFAULT_DISPLAY = (() => {
    if (!chipsContainer) return "block";
    const d = chipsContainer.style.display || getComputedStyle(chipsContainer).display;
    return d && d !== "none" ? d : "block";
  })();

  function setChipsVisible(visible) {
    if (!chipsContainer) return;
    chipsContainer.style.display = visible ? CHIPS_DEFAULT_DISPLAY : "none";
  }

  function disableChips(disabled = true) {
    chipsGroup.forEach(chip => {
      chip.disabled = disabled;
      chip.style.opacity = disabled ? "0.5" : "1";
      chip.style.cursor  = disabled ? "not-allowed" : "pointer";
    });
  }

  function shouldShowChips() {
    return !!(selGenero?.value && inFecha?.value);
  }

  function clearChipSelections() {
    // Limpia chips y <select> de días
    if (chipsContainer) chipsContainer.querySelectorAll(".chip")
      .forEach(btn => btn.setAttribute("aria-pressed", "false"));
    if (selDias) Array.from(selDias.options).forEach(o => (o.selected = false));
  }

  // 👀 Mostrar/ocultar label de NOMBRE y habilitar/deshabilitar input
  function updateNombreVisibility() {
    const visible = shouldShowChips();
    if (labNombre) labNombre.style.visibility = visible ? "visible" : "hidden";
    if (inNombre) {
      inNombre.disabled = !visible;          // bloqueo del input
      if (!visible) inNombre.value = "";     // opcional: limpiar si no visible
    }
  }

  function refreshChipsVisibility() {
    const visible = shouldShowChips();
    setChipsVisible(visible);
    updateNombreVisibility(); // <- sincroniza visibilidad del label "Nombre"

    if (!visible) {
      disableChips(true);
      clearChipSelections();
      // Limpia tabla cuando no hay filtros completos
      if (tablaHead) tablaHead.innerHTML = "";
      if (tablaBody) tablaBody.innerHTML = "";
      updateEliminarHabilitado();
    }
  }

  // Al inicio → chips ocultos y bloqueados
  setChipsVisible(false);
  disableChips(true);
  updateNombreVisibility(); // <- ocultar label al inicio

  // Util: escapar atributos HTML
  const escAttr = (s) =>
    String(s ?? "").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  // 📌 Calcular semana ISO
  function calcularSemanaISO(fechaStr) {
    const fecha = new Date(fechaStr);
    const dia = fecha.getDay() || 7;
    fecha.setDate(fecha.getDate() + 4 - dia);
    const inicioAño = new Date(fecha.getFullYear(), 0, 1);
    const diff = (fecha - inicioAño) / 86400000;
    return Math.ceil((diff + 1) / 7);
  }

  // ✅ Helper: detectar si una fila tiene cualquier dato
  function rowHasData(tr) {
    if (!tr) return false;
    const inputs = tr.querySelectorAll("input.in-ejercicio, input.in-reps");
    return Array.from(inputs).some(inp => {
      const v  = (inp.value || "").trim();
      const id = (inp.dataset?.id || "").trim();
      return v.length > 0 || id.length > 0;
    });
  }

  // ✅ Normaliza objetos de ejercicios desde el backend (cubre varias formas)
  function normalizeEj(raw) {
    if (!raw) return { id: "", nombre: "", reps: "" };
    const id =
      raw.ejercicioId?.toString?.() ||
      raw.ejercicio_id?.toString?.() ||
      raw._id?.toString?.() ||
      raw.id?.toString?.() ||
      raw.ejercicio?._id?.toString?.() ||
      raw.ejercicio?.id?.toString?.() ||
      "";

    const nombre =
      raw.nombre ||
      raw.ejercicio?.nombre ||
      raw.ejercicioNombre ||
      "";

    const reps =
      raw.reps?.toString?.() ||
      raw.repeticiones?.toString?.() ||
      raw.cantidad?.toString?.() ||
      raw.qty?.toString?.() ||
      "";

    return { id, nombre, reps };
  }

  // Igualdad de nombres ignorando espacios/caso
  function sameName(a, b) {
    const f = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
    return f(a) === f(b);
  }

  // 📌 Construir payload (robusto con ids)
  function construirPayload() {
    const nombre = (inNombre?.value || "").trim();
    const genero = selGenero?.value || "";
    const fecha  = inFecha?.value || "";
    const semana = calcularSemanaISO(fecha);

    const dias = Array.from(tablaHead.querySelectorAll("th[colspan]"))
      .map(th => th.textContent.trim());

    const ejercicios = [];
    const celdasSinId = [];

    for (let fila of tablaBody.rows) {
      dias.forEach((dia, i) => {
        const ejInput   = fila.cells[i * 2]?.querySelector("input.in-ejercicio");
        const repsInput = fila.cells[i * 2 + 1]?.querySelector("input.in-reps");

        const nombreEj = (ejInput?.value || "").trim();
        let idEj       = (ejInput?.dataset?.id || "").trim();
        const reps     = (repsInput?.value || "").trim();

        // 👉 Si no hay id, pero hay originales y el nombre NO cambió, restaura id
        if (!idEj && ejInput) {
          const oid   = (ejInput.dataset.origId || "").trim();
          const oname = (ejInput.dataset.origNombre || "").trim();
          if (oid && sameName(oname, nombreEj)) {
            idEj = oid;
            ejInput.dataset.id = oid; // persistir
          }
        }

        // Solo se empuja si hay reps y hay id válido.
        if (reps) {
          if (!idEj) {
            celdasSinId.push({ dia, nombre: nombreEj });
          } else {
            ejercicios.push({ ejercicioId: idEj, nombre: nombreEj, reps, dia });
          }
        }
      });
    }

    if (celdasSinId.length) {
      const detalle = celdasSinId
        .slice(0, 6)
        .map(c => `• Día ${c.dia}${c.nombre ? ` – "${c.nombre}"` : ""}`)
        .join("\n");
      alert(`⚠️ Hay repeticiones en celdas sin ejercicio válido seleccionado:\n${detalle}\n\nSelecciona el ejercicio desde el autocompletar o borra las reps.`);
      throw new Error("Celdas con reps pero sin ejercicioId");
    }

    return { nombre, genero, semana, ejercicios };
  }

  // 🔄 LIMPIAR TODO tras guardar/eliminar
  function resetFormulario() {
    // ID en memoria
    rutinaActualId = null;

    // Inputs
    if (inNombre) inNombre.value = "";
    if (selGenero) selGenero.value = "";
    if (inFecha) inFecha.value = "";

    // Tabla
    if (tablaHead) tablaHead.innerHTML = "";
    if (tablaBody) tablaBody.innerHTML = "";

    // Chips
    clearChipSelections();   // limpia selección de chips y <select> días
    disableChips(true);      // chips deshabilitados
    setChipsVisible(false);  // chips ocultos

    // Nombre: ocultar y deshabilitar otra vez
    updateNombreVisibility();

    // Botones
    updateEliminarHabilitado();

    // UX
    inNombre?.blur();
  }

  // 📌 Guardar o editar rutina
  async function guardarRutina() {
    let payload;
    try {
      payload = construirPayload();
    } catch (_e) {
      return; // Ya se avisó arriba
    }

    if (!payload.nombre || !payload.genero || !payload.semana) {
      alert("⚠️ Completa nombre, género y semana.");
      return;
    }

    if (!payload.ejercicios.length && !rutinaActualId) {
      alert("⚠️ Debes agregar al menos un ejercicio con repeticiones.");
      return;
    }

    try {
      const url = rutinaActualId ? `${API_BASE}/${rutinaActualId}` : API_BASE;
      const res = await fetch(url, {
        method: rutinaActualId ? "PUT" : "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || "Error al guardar rutina");

      alert(`✅ Rutina ${rutinaActualId ? "actualizada" : "creada"} con éxito`);

      // 🔄 Limpiar TODO tras guardar
      resetFormulario();

    } catch (err) {
      console.error("❌ Error:", err);
      alert("Error al guardar rutina");
    }
  }

  // 📌 Renderizar tabla (desde datos cargados)
  function renderTabla(dias, ejerciciosPorDia = {}) {
    tablaHead.innerHTML = "";
    tablaBody.innerHTML = "";
    if (!dias.length) return;

    let filaDias = "<tr>";
    dias.forEach(d => (filaDias += `<th colspan="2">${escAttr(d)}</th>`));
    filaDias += "</tr>";

    let filaEtiq = "<tr>";
    dias.forEach(() => (filaEtiq += "<th>Ejercicio</th><th>Reps</th>"));
    filaEtiq += "</tr>";

    tablaHead.innerHTML = filaDias + filaEtiq;

    const maxFilas = Math.max(
      ...Object.values(ejerciciosPorDia).map(arr => Array.isArray(arr) ? arr.length : 0),
      1
    );

    for (let r = 0; r < maxFilas; r++) {
      const fila = buildRow(dias, ejerciciosPorDia, r);
      tablaBody.appendChild(fila);
    }
    updateEliminarHabilitado();
  }

  // 📌 Crear fila (nueva o desde datos) — conserva ids originales
  function buildRow(dias, ejerciciosPorDia = {}, idx = 0) {
    const fila = document.createElement("tr");
    dias.forEach(dia => {
      const ejNorm = normalizeEj(ejerciciosPorDia[dia]?.[idx]);
      const nombre = escAttr(ejNorm.nombre || "");
      const ejId   = escAttr(ejNorm.id || "");
      const reps   = escAttr(ejNorm.reps || "");
      fila.innerHTML += `
        <td class="ejercicio" style="position:relative">
          <input type="text"
                 class="in-ejercicio"
                 value="${nombre}"
                 data-id="${ejId}"
                 data-orig-id="${ejId}"
                 data-orig-nombre="${nombre}"
                 placeholder="Ejercicio"
                 autocomplete="off">
          <ul class="sugerencias" style="display:none"></ul>
        </td>
        <td class="reps">
          <input type="text"
                 class="in-reps"
                 value="${reps}"
                 placeholder="Reps"
                 autocomplete="off">
        </td>
      `;
    });
    return fila;
  }

  function updateEliminarHabilitado() {
    btnEliminarFila.disabled = tablaBody.rows.length === 0;
  }

  // 📌 Agregar fila
  function agregarFila() {
    const dias = Array.from(tablaHead.querySelectorAll("th[colspan]"))
      .map(th => th.textContent.trim());
    if (!dias.length) {
      alert("⚠️ Debes seleccionar días y generar la tabla primero");
      return;
    }
    const fila = buildRow(dias);
    tablaBody.appendChild(fila);
    updateEliminarHabilitado();
  }

  // 📌 Eliminar última fila (solo si TODA está vacía)
  function eliminarFila() {
    const filas = tablaBody.rows.length;
    if (!filas) return;

    const ultima = tablaBody.rows[filas - 1];
    if (rowHasData(ultima)) {
      alert("⚠️ No puedes eliminar una fila con datos. Vacíala primero.");
      return;
    }
    tablaBody.deleteRow(filas - 1);
    updateEliminarHabilitado();
  }

  // 📌 Buscar rutina con filtro
  async function buscarRutina() {
    const fecha  = inFecha.value;
    const genero = selGenero.value;
    if (!fecha || !genero) {
      // Si alguno falta, esconde nombre/chips/tabla
      refreshChipsVisibility();
      return;
    }

    try {
      const url = `${API_BASE}/por-semana?genero=${encodeURIComponent(genero)}&fecha=${encodeURIComponent(fecha)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      inNombre.value = "";
      tablaHead.innerHTML = "";
      tablaBody.innerHTML = "";

      // Siempre que hay fecha+género, los chips se muestran
      setChipsVisible(true);
      updateNombreVisibility(); // <- mostrar nombre porque ya hay filtros

      if (!data.rutina) {
        rutinaActualId = null;
        tablaBody.innerHTML = `
          <tr><td colspan="10" style="text-align:center; color:gray; padding:12px">
            No existe rutina para esa semana.
          </td></tr>
        `;
        disableChips(false); // crear nueva → chips habilitados
        return;
      }

      rutinaActualId = data.rutina._id;
      inNombre.value  = data.rutina.nombre;

      const dias = Object.keys(data.ejercicios || {});
      renderTabla(dias, data.ejercicios || {});

      // En edición, chips visibles pero bloqueados
      disableChips(true);
    } catch (err) {
      console.error("❌ Error al buscar rutina:", err);
    }
  }

  async function eliminarRutina() {
    if (!rutinaActualId) {
      alert("⚠️ No hay rutina seleccionada para eliminar.");
      return;
    }
    if (!confirm("¿Seguro que deseas eliminar esta rutina?")) return;

    try {
      const res = await fetch(`${API_BASE}/${rutinaActualId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || "Error al eliminar rutina");

      alert("✅ Rutina eliminada con éxito");

      // 🔄 Limpia TODO tras eliminar
      resetFormulario();
    } catch (err) {
      console.error("❌ Error eliminando rutina:", err);
      alert("Error al eliminar rutina");
    }
  }

  // === Eventos (sin duplicar agregar/eliminar filas)
  btnEliminar?.addEventListener("click", eliminarRutina);
  btnGuardar?.addEventListener("click", guardarRutina);

  selGenero?.addEventListener("change", () => {
    refreshChipsVisibility();
    buscarRutina();
  });
  inFecha?.addEventListener("change", () => {
    refreshChipsVisibility();
    buscarRutina();
  });

  // ✅ Candado global para evitar doble registro con dashboard.js
  function bindFilaHandlersRutina() {
    if (!window.__ROW_HANDLERS_BOUND__) {
      window.__ROW_HANDLERS_BOUND__ = "rutina";
      btnAgregarFila?.addEventListener("click", agregarFila);
      btnEliminarFila?.addEventListener("click", eliminarFila);
    }
  }
  bindFilaHandlersRutina();
});
