document.addEventListener('DOMContentLoaded', async () => {
  const API = "http://localhost:4000/api/agendamientoRT";
  const token = localStorage.getItem("token");
  if (!token) { alert("⚠️ Sesión expirada."); location.href = "../../login.html"; return; }

  const diaActivo = document.getElementById('diaActivo');
  const listaHorarios = document.getElementById('listaHorarios');

  let fechaISO = null;
  let miGenero = null;        // 'M'|'F' o 'masculino'|'femenino'
  let reservadoId = null;
  let busy = false;
  let socket;

  const H = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${token}` });
  const isMale = (g) => ['m','masculino','h','hombre','male','man'].includes((g||'').toString().trim().toLowerCase());

  function mkCapText(libH, cupoH, libM, cupoM){ return `H: ${libH}/${cupoH} • M: ${libM}/${cupoM}`; }

  function render(items) {
    listaHorarios.innerHTML = '';
    reservadoId = null;

    items.forEach(it => {
      const id = String(it.horarioId);

      const soyH = isMale(miGenero);
      const libresG = soyH ? it.libresHombres : it.libresMujeres;
      const cupoG   = soyH ? it.cupoHombres   : it.cupoMujeres;
      const ratio   = cupoG ? (libresG / cupoG) : 0;
      let badgeClass = 'badge-libre';
      if (libresG <= 0) badgeClass = 'badge-llena';
      else if (ratio <= 0.3) badgeClass = 'badge-medias';

      const label = document.createElement('label');
      label.className = 'check';
      label.dataset.hid = id;
      label.dataset.cupoH = it.cupoHombres;
      label.dataset.cupoM = it.cupoMujeres;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'horarioHoy';
      radio.value = id;

      const dot = document.createElement('span'); dot.className = 'dot';

      const left = document.createElement('div'); left.className = 'check-left';
      const tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = `${it.hInicio} - ${it.hFin}`;
      const badge = document.createElement('span'); badge.className = `badge-disp ${badgeClass}`; badge.id = `badge-${id}`;
      badge.textContent = libresG > 0 ? `${libresG} libres` : 'Sin cupo';
      left.append(dot, tx, badge);

      const caps = document.createElement('small'); caps.className = 'cap'; caps.id = `cap-${id}`;
      caps.textContent = mkCapText(it.libresHombres, it.cupoHombres, it.libresMujeres, it.cupoMujeres);

      if (it.yoReservado) {
        radio.checked = true;
        label.classList.add('selected');
        reservadoId = id;
      }

      const noCupoMio = soyH ? (it.libresHombres === 0) : (it.libresMujeres === 0);
      if (noCupoMio && !it.yoReservado) { radio.disabled = true; label.classList.add('disabled'); }

      label.addEventListener('click', async (ev) => {
        ev.preventDefault();
        if (busy) return;
        if (radio.disabled && !label.classList.contains('selected')) return;

        try {
          busy = true;

          if (label.classList.contains('selected')) {
            // cancelar
            await new Promise((resolve, reject) => {
              socket.emit('agenda:cancelar', { horarioId: id }, (ack) => ack?.ok ? resolve() : reject(new Error(ack?.mensaje || 'Error al cancelar')));
            });
            radio.checked = false;
            label.classList.remove('selected');
            reservadoId = null;
          } else {
            // reservar
            await new Promise((resolve, reject) => {
              socket.emit('agenda:reservar', { horarioId: id }, (ack) => ack?.ok ? resolve() : reject(new Error(ack?.mensaje || 'Cupo agotado')));
            });

            listaHorarios.querySelectorAll('label.check').forEach(l => l.classList.remove('selected'));
            listaHorarios.querySelectorAll('input[name="horarioHoy"]').forEach(i => i.checked = false);
            radio.checked = true;
            label.classList.add('selected');

            if (reservadoId && reservadoId !== id) {
              try { socket.emit('agenda:cancelar', { horarioId: reservadoId }, () => {}); } catch(_){}
            }
            reservadoId = id;
          }
        } catch (e) {
          alert('❌ ' + e.message);
        } finally {
          busy = false;
        }
      });

      label.append(radio, left, caps);
      listaHorarios.appendChild(label);
    });
  }

  function updateCapsUI(horarioId, libresH, libresM) {
    const cap = document.getElementById(`cap-${horarioId}`);
    const lab = listaHorarios.querySelector(`label.check[data-hid="${horarioId}"]`);
    if (!lab) return;

    const cupoH = Number(lab.dataset.cupoH || 0);
    const cupoM = Number(lab.dataset.cupoM || 0);
    if (cap) cap.textContent = mkCapText(libresH, cupoH, libresM, cupoM);

    const badge = document.getElementById(`badge-${horarioId}`);
    if (badge) {
      const libresG = isMale(miGenero) ? libresH : libresM;
      badge.textContent = libresG > 0 ? `${libresG} libres` : 'Sin cupo';
      badge.classList.remove('badge-libre','badge-medias','badge-llena');
      if (libresG <= 0) badge.classList.add('badge-llena');
      else if (libresG <= 2) badge.classList.add('badge-medias');
      else badge.classList.add('badge-libre');
    }

    const input = lab.querySelector('input[type="radio"]');
    const sinCupo = isMale(miGenero) ? libresH === 0 : libresM === 0;
    if (!lab.classList.contains('selected')) {
      input.disabled = sinCupo;
      lab.classList.toggle('disabled', sinCupo);
    }
  }

  async function cargar() {
    const r = await fetch(`${API}/activa`, { headers: H() });
    const js = await r.json();
    if (!r.ok) throw new Error(js.mensaje || 'Error');

    fechaISO = js.fechaISO;
    miGenero = js.miGenero || js.miSexo;

    diaActivo.textContent = js.dia;
    diaActivo.title = js.fechaISO;
    render(js.data);
  }

  function conectarSocket() {
    socket = io("http://localhost:4000", {
      transports: ['websocket'],
      auth: { token }
    });

    // unirse a la sala del día activo
    socket.emit('agenda:join', { fechaISO });

    // updates en vivo de cupos
    socket.on('agenda:update', (p) => {
      if (p.fechaISO !== fechaISO) return;
      updateCapsUI(String(p.horarioId), p.libresHombres, p.libresMujeres);
    });

    // rollover en vivo: cambiar de día justo al cutoff
    socket.on('agenda:rollover', async ({ fechaISO: nueva }) => {
      try {
        const prev = fechaISO;
        await cargar(); // ya pinta el día nuevo según /activa
        if (fechaISO !== prev) {
          try { socket.emit('agenda:join', { fechaISO }); } catch {}
        }
      } catch {}
    });

    socket.on('connect_error', (err) => console.warn('Socket connect_error:', err?.message));
  }

  // fallback por si el navegador estaba dormido y se saltó el evento
  setInterval(async () => {
    try {
      const prev = fechaISO;
      await cargar();
      if (fechaISO !== prev) {
        try { socket?.disconnect(); } catch {}
        conectarSocket();
      }
    } catch {}
  }, 60_000);

  try { await cargar(); conectarSocket(); }
  catch(e){ console.error(e); listaHorarios.innerHTML = '<p>Error al cargar agenda.</p>'; }
});
