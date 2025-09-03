const API_URL = 'http://localhost:4000/api/ejercicios';
const token = localStorage.getItem('token');

// Si no hay sesión, redirige
if (!token) {
  alert('Sesión no iniciada. Inicia sesión nuevamente.');
  window.location.href = '../../login.html';
}

// Refs DOM
const inputBuscar = document.getElementById('searchInput');
const inputNombre = document.getElementById('nombreEjercicio');
const inputDesc   = document.getElementById('descripcionEjercicio');
const inputTipo   = document.getElementById('tipoEjercicio');
const ulLista     = document.getElementById('exerciseList');

// Controles de acción (los tres botones al final)
const [btnCrear, btnEliminar, btnEditar] = document.querySelectorAll('.action-buttons button');

// Estado
let ejercicios = [];       // cache de la lista actual
let seleccionadoId = null; // _id del ejercicio seleccionado

// Helpers
const authHeaders = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

function renderLista(items) {
  ulLista.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = 'Sin resultados';
    li.style.opacity = 0.6;
    ulLista.appendChild(li);
    return;
  }

  items.forEach(ej => {
    const li = document.createElement('li');
    li.textContent = `${ej.nombre} ${ej.tipo ? `— ${ej.tipo}` : ''}`;
    li.dataset.id = ej._id;
    li.className = 'item-ejercicio';
    ulLista.appendChild(li);
  });
}

function limpiarForm() {
  inputNombre.value = '';
  inputDesc.value = '';
  inputTipo.value = '';
}

function salirEdicion() {
  seleccionadoId = null;
  limpiarForm();
  // Quitar selección visual
  ulLista.querySelectorAll('.selected').forEach(li => li.classList.remove('selected'));
}

function getPayload() {
  return {
    nombre: inputNombre.value.trim(),
    descripcion: inputDesc.value.trim(),
    tipo: inputTipo.value.trim()
  };
}

// =============================
// Cargar/Buscar
// =============================
async function cargarEjercicios(params = {}) {
  // params: { q, page, limit, sort }
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${API_URL}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.mensaje || 'Error al listar ejercicios');
    ejercicios = data.data || [];
    renderLista(ejercicios);
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// Búsqueda “en vivo”
function filterList() {
  const q = inputBuscar.value.trim();
  cargarEjercicios(q ? { q } : {});
}
window.filterList = filterList; // tu HTML lo llama onkeyup

// =============================
// Crear
// =============================
async function crearEjercicio() {
  const payload = getPayload();
  if (!payload.nombre) return alert('El nombre es obligatorio');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudo crear el ejercicio');
    }
    salirEdicion();
    cargarEjercicios();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// =============================
// Editar (actualizar)
// =============================
async function actualizarEjercicio() {
  if (!seleccionadoId) return alert('Selecciona un ejercicio de la lista');

  const payload = getPayload();
  if (!payload.nombre) return alert('El nombre es obligatorio');

  try {
    const res = await fetch(`${API_URL}/${seleccionadoId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudo actualizar el ejercicio');
    }
    salirEdicion();
    cargarEjercicios({ q: inputBuscar.value.trim() || undefined });
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// =============================
// Eliminar
// =============================
async function eliminarEjercicio() {
  if (!seleccionadoId) return alert('Selecciona un ejercicio de la lista');
  if (!confirm('¿Eliminar este ejercicio?')) return;

  try {
    const res = await fetch(`${API_URL}/${seleccionadoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo eliminar');

    salirEdicion();
    cargarEjercicios({ q: inputBuscar.value.trim() || undefined });
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// =============================
// Delegación: click en lista
// =============================
ulLista.addEventListener('click', (e) => {
  const li = e.target.closest('li.item-ejercicio');
  if (!li) return;

  // Quitar selección previa
  ulLista.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  li.classList.add('selected');

  seleccionadoId = li.dataset.id;
  const ej = ejercicios.find(x => x._id === seleccionadoId);
  if (ej) {
    inputNombre.value = ej.nombre || '';
    inputDesc.value   = ej.descripcion || '';
    inputTipo.value   = ej.tipo || '';
  }
});

// =============================
// Botones de acción
// =============================
btnCrear.addEventListener('click', crearEjercicio);
btnEditar.addEventListener('click', actualizarEjercicio);
btnEliminar.addEventListener('click', eliminarEjercicio);

// =============================
// Inicializar
// =============================
cargarEjercicios();
