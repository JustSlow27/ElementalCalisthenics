// utils/scripts/cliente/rutinaCliente.js
document.addEventListener("DOMContentLoaded", async () => {
  const API_RUTINA_CLIENTE = "http://3.149.75.175:80/api/rutinas/mia";
  const token = localStorage.getItem("token");
  const nombre = localStorage.getItem("nombreUsuario");

  if (!token) {
    alert("⚠️ Sesión expirada. Inicia sesión de nuevo.");
    window.location.href = "../../login.html";
    return;
  }

  const nombreRutina = document.getElementById("nombreRutina");
  const theadDias    = document.getElementById("theadDias");
  const theadSub     = document.getElementById("theadSub");
  const tbodyRutina  = document.getElementById("tbodyRutina");

  // Modal
  const modal      = document.getElementById("modalEjercicio");
  const modalTitle = document.getElementById("egModalTitle");
  const modalDesc  = document.getElementById("egModalDesc");

  document.getElementById('nombreUsuario').textContent = `👤 ${nombre}`;

  // Estado local para consultas del modal
  let _ejerciciosPorDia = {};

  // ===== Helpers de días (normalización, canon, etiquetas) =====
  const DOW_ORDER = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"];
  const LABELS = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes",
    sabado: "Sábado",
    domingo: "Domingo"
  };

  const stripAccents = (s) =>
    (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const normDia = (s) =>
    stripAccents(s).toLowerCase().trim();

  // Devuelve el canónico en español sin tildes (lunes..domingo)
  const canonDia = (s) => {
    const n = normDia(s).replace(/\s+/g, "");
    if (n.startsWith("lun")) return "lunes";
    if (n.startsWith("mar")) return "martes";
    if (n.startsWith("mie")) return "miercoles"; // “miércoles”, “miercoles”, “mie”
    if (n.startsWith("jue")) return "jueves";
    if (n.startsWith("vie")) return "viernes";
    if (n.startsWith("sab")) return "sabado";    // “sábado”, “sab”
    if (n.startsWith("dom")) return "domingo";
    return n; // desconocido (se irá a extras al final si existiera)
  };

  const labelDia = (d) => LABELS[d] || (d.charAt(0).toUpperCase() + d.slice(1));

  // ===== Helpers modal =====
  function openModal(title, desc) {
    modalTitle.textContent = title || "Ejercicio";
    modalDesc.textContent  = desc || "Sin descripción disponible.";
    modal.classList.add("eg-open");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    modal.classList.remove("eg-open");
    modal.setAttribute("aria-hidden", "true");
  }
  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("eg-open")) closeModal();
  });

  // Permite probar otra semana con ?semana=NN (opcional)
  const qs = new URLSearchParams(location.search);
  const semanaQS = qs.get("semana");
  const apiURL = new URL(API_RUTINA_CLIENTE);
  if (semanaQS) apiURL.searchParams.set("semana", semanaQS);

  try {
    const res = await fetch(apiURL.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });

    let data = {};
    try { data = await res.json(); } catch { data = {}; }

    if (res.status === 404) {
      nombreRutina.textContent = "Sin rutina";
      theadDias.innerHTML = "";
      theadSub.innerHTML  = "";
      tbodyRutina.innerHTML = `<tr><td colspan="100%">No hay rutina publicada para esta semana.</td></tr>`;
      return;
    }
    if (!res.ok) throw new Error(data.mensaje || "Error desconocido");

    // ===== Rutina + ejercicios =====
    nombreRutina.textContent = data.rutina?.nombre || "Sin rutina";

    // Normaliza llaves de días, quita tildes, fusiona duplicados y omite días sin ejercicios
    const ejRaw  = data.ejercicios || {};
    const ejNorm = {};
    for (const [k, v] of Object.entries(ejRaw)) {
      const canon = canonDia(k);
      const arr = Array.isArray(v) ? v : [];
      if (!arr.length) continue;                // omite días sin ejercicios
      ejNorm[canon] = (ejNorm[canon] || []).concat(arr); // fusiona si llegaron duplicados (p.ej. “Miércoles” y “miercoles”)
    }

    // Orden final: solo días con ejercicios, en orden L->D; extras (desconocidos) al final
    const dias = DOW_ORDER.filter(d => ejNorm[d] && ejNorm[d].length > 0);
    const extras = Object.keys(ejNorm).filter(d => !DOW_ORDER.includes(d));
    if (extras.length) dias.push(...extras);

    if (!dias.length) {
      theadDias.innerHTML = "";
      theadSub.innerHTML  = "";
      tbodyRutina.innerHTML = `<tr><td colspan="100%">No hay ejercicios asignados.</td></tr>`;
      return;
    }

    // Guarda estructura para modal
    _ejerciciosPorDia = ejNorm;

    // ===== Encabezados (dos filas fijas) =====
    theadDias.innerHTML = dias.map(d => `<th colspan="2">${labelDia(d)}</th>`).join("");
    theadSub.innerHTML  = dias.map(() => `<th>Ejercicio</th><th>Reps</th>`).join("");

    // Nº máximo de filas entre todos los días
    const maxFilas = Math.max(...dias.map(d => (_ejerciciosPorDia[d]?.length || 0)));

    // ===== Cuerpo =====
    tbodyRutina.innerHTML = "";
    for (let i = 0; i < maxFilas; i++) {
      const tr = document.createElement("tr");

      dias.forEach(dia => {
        const ej = _ejerciciosPorDia[dia]?.[i];

        // Celda: Ejercicio + botón info
        const tdEj = document.createElement("td");
        if (ej) {
          const span = document.createElement("span");
          span.className = "ej-nombre";
          span.textContent = ej.nombre ?? "—";

          const btn = document.createElement("button");
          btn.className = "btn-info";
          btn.type = "button";
          btn.title = "Ver descripción";
          btn.setAttribute("aria-label", `Ver descripción de ${ej.nombre ?? "ejercicio"}`);
          btn.dataset.dia = dia;       // día canónico
          btn.dataset.i = String(i);   // índice en el array del día
          btn.textContent = "ℹ️";

          tdEj.appendChild(span);
          tdEj.appendChild(btn);
        } else {
          tdEj.textContent = "";
        }

        // Celda: Reps
        const tdReps = document.createElement("td");
        tdReps.textContent = ej?.reps ?? "";

        tr.appendChild(tdEj);
        tr.appendChild(tdReps);
      });

      tbodyRutina.appendChild(tr);
    }

    // ===== Delegación de eventos del modal (evita duplicados si se reinyecta) =====
    const tabla = document.getElementById("tablaRutinaUsuario");
    tabla.replaceWith(tabla.cloneNode(true));
    const tablaNueva = document.getElementById("tablaRutinaUsuario");
    tablaNueva.addEventListener("click", (e) => {
      const btn = e.target.closest("button.btn-info");
      if (!btn) return;

      const dia = btn.dataset.dia;
      const idx = Number(btn.dataset.i);
      const ej  = _ejerciciosPorDia?.[dia]?.[idx];

      const titulo = ej?.nombre ?? "Ejercicio";
      const desc   = ej?.descripcion
                  ?? ej?.descripcionLarga
                  ?? ej?.detalle
                  ?? "Sin descripción disponible.";

      openModal(titulo, desc);
    });

  } catch (err) {
    console.error("❌ Error al obtener rutina:", err);
    nombreRutina.textContent = "Sin rutina";
    theadDias.innerHTML = "";
    theadSub.innerHTML  = "";
    tbodyRutina.innerHTML = `<tr><td colspan="100%">Error al cargar rutina</td></tr>`;
  }
});
