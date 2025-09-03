const API_BASE = 'http://3.149.75.175:80/api';
const token = localStorage.getItem('token');

if (!token) {
  alert('Sesión expirada. Inicia sesión de nuevo.');
  window.location.href = '../../login.html';
}

const headersAuth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// DOM
const form = document.getElementById('rolesForm');
const inputNombre = document.getElementById('usuarioname'); // búsqueda por nombre
const selectFiltroRol = document.getElementById('filtroRol');
const tbody = document.querySelector('#tablaUsuarios tbody');

const debounce = (fn, ms=250) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };

function toast(msg, ok = true) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);
    background:${ok ? '#111827' : '#991b1b'};color:#fff;padding:10px 14px;border-radius:12px;
    opacity:0;transition:.25s;z-index:1000;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = 1; el.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { el.style.opacity = 0; el.style.transform = 'translateX(-50%) translateY(20px)'; }, 2200);
  setTimeout(() => el.remove(), 2600);
}

function rolLabel(rol) {
  if (rol === 'admin') return 'Administrador';
  if (rol === 'entrenador') return 'Entrenador';
  if (rol === 'cliente') return 'Cliente';
  if (rol === 'pendiente') return 'Pendiente';
  return rol || '—';
}

let lista = []; // usuarios mostrados actualmente

function render(rows, modo) {
  tbody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="text-align:center;color:#64748b;padding:18px;">Sin usuarios para mostrar</td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(u => {
    const tr = document.createElement('tr');
    tr.dataset.id = u._id;

    let acciones = '';
    if (u.rol === 'pendiente') {
      acciones = `
        <div class="inline-assign" style="display:flex;gap:8px;align-items:center;">
          <select class="inline-rol">
            <option value="" disabled selected>Rol…</option>
            <option value="admin">Administrador</option>
            <option value="entrenador">Entrenador</option>
            <option value="cliente">Cliente</option>
          </select>
          <button class="btn-primary btn-assign">Asignar</button>
        </div>`;
    } else if (u.rol === 'cliente' || u.rol === 'entrenador') {
      acciones = `<button class="btn-danger btn-delete">Eliminar</button>`;
    } else {
      acciones = '—';
    }

    tr.innerHTML = `
      <td class="td-nombre"><div class="user-name">${u.nombre || '—'}</div></td>
      <td>${rolLabel(u.rol)}</td>
      <td>${u.sexo || '—'}</td>
      <td class="td-actions">${acciones}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Mapeo de select → query roles
function rolesParamFromSelectValue(val) {
  if (val === 'pendiente')  return 'pendiente';
  if (val === 'ec')         return 'entrenador,cliente';
  if (val === 'entrenador') return 'entrenador';
  if (val === 'cliente')    return 'cliente';
  // default: pendientes
  return 'pendiente';
}

async function cargarUsuarios() {
  try {
    const rolesParam = rolesParamFromSelectValue(selectFiltroRol.value);
    const nombre = (inputNombre.value || '').trim();

    const params = new URLSearchParams();
    if (rolesParam) params.set('roles', rolesParam);
    if (nombre) params.set('nombre', nombre);

    const url = `${API_BASE}/usuarios/filtrar${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, { headers: headersAuth });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.mensaje || 'No se pudieron cargar usuarios');

    lista = Array.isArray(data.data) ? data.data : [];
    render(lista, selectFiltroRol.value);
  } catch (err) {
    console.error(err);
    toast(err.message || 'Error cargando usuarios', false);
  }
}

// Delegación de eventos en tabla
tbody.addEventListener('click', async (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = tr.dataset.id;

  // Asignar rol en línea (solo pendientes)
  if (e.target.classList.contains('btn-assign')) {
    const btn = e.target;
    const select = tr.querySelector('.inline-rol');
    const rol = select.value;
    if (!rol) return toast('Elige un rol.', false);

    try {
      btn.disabled = true;
      btn.textContent = 'Asignando…';
      const res = await fetch(`${API_BASE}/usuarios/${id}/rol`, {
        method: 'PATCH',
        headers: headersAuth,
        body: JSON.stringify({ rol })
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.mensaje || 'No se pudo asignar el rol');

      toast(`Rol asignado: ${rolLabel(rol)}.`);
      await cargarUsuarios(); // refresca lista según filtro actual
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al asignar rol', false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Asignar';
    }
  }

  // Eliminar usuario (cliente o entrenador)
  if (e.target.classList.contains('btn-delete')) {
    if (!confirm('¿Eliminar definitivamente este usuario? Esta acción no se puede deshacer.')) return;

    try {
      e.target.disabled = true;

      // 1er intento: sin force
      let res = await fetch(`${API_BASE}/usuarios/${id}`, {
        method: 'DELETE',
        headers: headersAuth
      });
      let data = await res.json();

      if (res.status === 409) {
        // Tiene pagos asociados → preguntar si forzamos
        const okForce = confirm('Este usuario tiene pagos asociados. ¿Eliminar también sus pagos? Esta acción no se puede deshacer.');
        if (!okForce) {
          throw new Error(data.mensaje || 'No se puede eliminar: el usuario tiene pagos asociados');
        }

        // 2do intento: con force=true
        res = await fetch(`${API_BASE}/usuarios/${id}?force=true`, {
          method: 'DELETE',
          headers: headersAuth
        });
        data = await res.json();
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data.mensaje || 'No se pudo eliminar');
      }

      toast(data.mensaje || 'Usuario eliminado.');
      await cargarUsuarios();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al eliminar', false);
    } finally {
      e.target.disabled = false;
    }
  }
});

// Filtros
selectFiltroRol.addEventListener('change', cargarUsuarios);
inputNombre.addEventListener('input', debounce(cargarUsuarios, 260));
form.addEventListener('reset', () => setTimeout(cargarUsuarios, 0));

// Init
// Por defecto, "Pendientes"
cargarUsuarios();
