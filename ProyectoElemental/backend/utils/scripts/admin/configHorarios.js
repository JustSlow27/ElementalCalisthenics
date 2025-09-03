const API_URL = 'http://localhost:4000/api/config-horarios';
const token = localStorage.getItem('token');

// Redirigir si no hay sesión
if (!token) {
  alert('Sesión no iniciada. Inicia sesión nuevamente.');
  window.location.href = '../../login.html';
}

// Refs
const form = document.getElementById('horarioForm');
const tablaBody = document.querySelector('#tablaHorarios tbody');
const btnGuardar = document.getElementById('btnGuardar');
const btnCancelar = document.getElementById('btnCancelar');
const inputId = document.getElementById('horarioId');

// Estado edición
let selectedRowId = null;

// =============================
// Cargar horarios
// =============================
async function cargarHorarios() {
  try {
    const res = await fetch(API_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.mensaje || 'Error al listar');
    renderTabla(data.data);
  } catch (err) {
    console.error(err);
    alert('No se pudieron cargar los horarios.');
  }
}

// =============================
// Render tabla + delegación click
// =============================
function renderTabla(horarios) {
  tablaBody.innerHTML = '';

  horarios.forEach(h => {
    const tr = document.createElement('tr');
    tr.dataset.id = h._id;
    tr.innerHTML = `
      <td>${h.dia}</td>
      <td>${h.hInicio}</td>
      <td>${h.hFin}</td>
      <td>${h.cupoHombres}</td>
      <td>${h.cupoMujeres}</td>
      <td>
        <button class="btn-secondary btn-eliminar" data-id="${h._id}">Eliminar</button>
      </td>
    `;
    tablaBody.appendChild(tr);
  });

  if (horarios.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="text-align:center; padding:10px;">No hay horarios configurados</td>`;
    tablaBody.appendChild(tr);
  }
}

// Delegación: click en fila para editar / click en botón eliminar
tablaBody.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-eliminar');
  if (btn) {
    const id = btn.dataset.id;
    eliminarHorario(id);
    return;
  }

  const tr = e.target.closest('tr');
  if (!tr || !tr.dataset.id) return;

  // Quitar selección previa
  tablaBody.querySelectorAll('tr.is-selected').forEach(r => r.classList.remove('is-selected'));
  tr.classList.add('is-selected');

  // Cargar datos de la fila al form
  const celdas = tr.querySelectorAll('td');
  const selected = {
    _id: tr.dataset.id,
    dia: celdas[0].textContent.trim(),
    hInicio: celdas[1].textContent.trim(),
    hFin: celdas[2].textContent.trim(),
    cupoHombres: celdas[3].textContent.trim(),
    cupoMujeres: celdas[4].textContent.trim()
  };
  llenarFormulario(selected);
});

// =============================
// Llenar formulario / Modo edición
// =============================
function llenarFormulario(h) {
  inputId.value = h._id;
  form.dia.value = toCapitalized(h.dia);
  form.hInicio.value = h.hInicio;
  form.hFin.value = h.hFin;
  form.cupoHombres.value = h.cupoHombres;
  form.cupoMujeres.value = h.cupoMujeres;

  selectedRowId = h._id;
  btnGuardar.textContent = 'Actualizar';
  btnCancelar.classList.remove('hidden');
}

// Cancelar edición
btnCancelar.addEventListener('click', () => {
  salirModoEdicion();
});

function salirModoEdicion() {
  form.reset();
  inputId.value = '';
  selectedRowId = null;
  btnGuardar.textContent = 'Guardar';
  btnCancelar.classList.add('hidden');
  // quitar selección visual
  tablaBody.querySelectorAll('tr.is-selected').forEach(r => r.classList.remove('is-selected'));
}

// =============================
// Guardar (crear o actualizar)
// =============================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = Object.fromEntries(new FormData(form));
  payload.dia = (payload.dia || '').trim().toLowerCase();

  try {
    let res, data;

    if (selectedRowId) {
      // UPDATE (PATCH)
      res = await fetch(`${API_URL}/${selectedRowId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          dia: payload.dia,
          hInicio: payload.hInicio,
          hFin: payload.hFin,
          cupoHombres: Number(payload.cupoHombres),
          cupoMujeres: Number(payload.cupoMujeres)
        })
      });
      data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || data.errores?.join(', ') || 'Error al actualizar');
      alert('Horario actualizado.');
    } else {
      // CREATE (POST)
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          dia: payload.dia,
          hInicio: payload.hInicio,
          hFin: payload.hFin,
          cupoHombres: Number(payload.cupoHombres),
          cupoMujeres: Number(payload.cupoMujeres)
        })
      });
      data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || data.errores?.join(', ') || 'Error al guardar');
      alert('Horario guardado.');
    }

    salirModoEdicion();
    cargarHorarios();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

// =============================
// Eliminar
// =============================
async function eliminarHorario(id) {
  if (!confirm('¿Eliminar este horario?')) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.mensaje || 'Error al eliminar');
    // Si estabas editando ese mismo, sal del modo edición
    if (selectedRowId === id) salirModoEdicion();
    cargarHorarios();
    alert('Horario eliminado.');
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// Utilidad
function toCapitalized(str) {
  if (!str) return str;
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

// Init
cargarHorarios();
