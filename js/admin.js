/* ============================================
   VOY — Admin App Logic (Airtable conectado)
   ============================================ */

let adminVerifications = [];
let adminTransactions  = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión — solo admins
  const session = VoyAuth.requireRole('admin');
  if (!session) return;
  VoyAuth.applySessionToUI(session);

  showAdminLoading();
  try {
    await VOY_DATA.init();
    [adminVerifications, adminTransactions] = await Promise.all([
      VoyDB.getVerifications(),
      VoyDB.getTransactions(),
    ]);

    buildAdminChart();
    buildCategoryBreakdown();
    loadPendingVerifPreview();
    loadRecentTransactions();
    loadVerificationsList();
    loadUsersTable();
    loadTransTable();
    loadCategoriesAdmin();
    loadConfigView();
    loadAdminStats();
  } catch (e) {
    VOY.showToast('Error cargando panel admin', 'error');
    console.error(e);
  }
});

function showAdminLoading() {
  ['pendingVerifPreview','recentTransactions'].forEach(id => VOY.showLoading(id));
}

/* ── Helper ─────────────────────────────── */
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Admin stats ────────────────────────── */
function loadAdminStats() {
  const s   = VOY_DATA.stats;
  const total = s.totalWorkers + s.totalClients;

  // Usar datos reales de Airtable, con baseline para demo realista
  setEl('statTotalUsers',    (total + 3200).toLocaleString('es-CL'));
  setEl('statTotalWorkers',  (s.totalWorkers + 538).toLocaleString('es-CL'));
  setEl('statTotalServices', (s.totalServices + 12880).toLocaleString('es-CL'));
  setEl('statRevenue',       s.totalRevenue > 0
    ? VOY.formatCLP(s.totalRevenue)
    : '$89,4M');

  // Actualizar badge de verificaciones en sidebar
  const pending = adminVerifications.filter(v => v.status === 'pending').length;
  setEl('verifBadge', pending || '');
}

/* ── Admin chart ────────────────────────── */
function buildAdminChart() {
  const el = document.getElementById('adminChart');
  if (!el) return;
  // Agrupar transacciones por mes
  const monthCounts = {};
  adminTransactions.forEach(t => {
    const m = t.date?.split(' ')[1] || 'Mar';
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  const months = [
    { m: 'Oct', v: 620 }, { m: 'Nov', v: 780 }, { m: 'Dic', v: 950 },
    { m: 'Ene', v: 840 }, { m: 'Feb', v: 1020 },
    { m: 'Mar', v: Math.max(adminTransactions.filter(t => t.date?.includes('Mar')).length || 0, 823), hl: true },
  ];
  const max = Math.max(...months.map(x => x.v));
  el.innerHTML = months.map(m => `
    <div class="admin-bar-wrap">
      <div style="font-size:9px;color:var(--gray-500);margin-bottom:2px;">${m.v}</div>
      <div class="admin-bar ${m.hl ? 'highlight' : ''}" style="height:${Math.round(m.v/max*100)}%;" title="${m.v} servicios"></div>
      <span class="admin-bar-label">${m.m}</span>
    </div>`).join('');
}

/* ── Category breakdown ─────────────────── */
function buildCategoryBreakdown() {
  const el = document.getElementById('categoryBreakdown');
  if (!el) return;

  const totals = {};
  VOY_DATA.bookings.forEach(b => {
    totals[b.category] = (totals[b.category] || 0) + 1;
  });
  const total = Object.values(totals).reduce((a,b)=>a+b,0) || 1;

  const data = VOY_DATA.categories.map(c => ({
    id: c.id, label: c.label, color: c.color,
    pct: Math.round((totals[c.id] || 0) / total * 100),
  })).filter(d => d.pct > 0);

  // Si no hay bookings reales, usar datos demo
  const display = data.length ? data : [
    { id:'gasfiteria',   label:'Gasfitería',   color:'#2563EB', pct:28 },
    { id:'electricidad', label:'Electricidad',  color:'#0EA5E9', pct:22 },
    { id:'limpieza',     label:'Limpieza',      color:'#14B8A6', pct:18 },
    { id:'belleza',      label:'Belleza',        color:'#EC4899', pct:14 },
    { id:'mecanica',     label:'Mecánica',       color:'#F59E0B', pct:9  },
    { id:'otros',        label:'Otros',          color:'#6B7280', pct:9  },
  ];

  el.innerHTML = display.map(d => `
    <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-3);">
      <div style="width:10px;height:10px;border-radius:50%;background:${d.color};flex-shrink:0;"></div>
      <span style="flex:1;font-size:var(--text-sm);color:var(--gray-700);">${d.label}</span>
      <div style="flex:2;height:6px;background:var(--gray-100);border-radius:4px;">
        <div style="height:6px;width:${d.pct}%;background:${d.color};border-radius:4px;"></div>
      </div>
      <span style="font-size:var(--text-xs);font-weight:600;color:var(--gray-500);min-width:28px;text-align:right;">${d.pct}%</span>
    </div>`).join('');
}

/* ── Pending verifications preview ─────── */
function loadPendingVerifPreview() {
  const el = document.getElementById('pendingVerifPreview');
  if (!el) return;
  const pending = adminVerifications.filter(v => v.status === 'pending');
  if (!pending.length) {
    el.innerHTML = '<div style="padding:var(--sp-4);text-align:center;color:var(--gray-400);font-size:var(--text-sm);">Sin verificaciones pendientes</div>';
    return;
  }
  el.innerHTML = pending.slice(0, 3).map(v => `
    <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--gray-100);">
      <img src="${v.avatar}" class="avatar avatar-sm" />
      <div style="flex:1;">
        <div style="font-size:var(--text-sm);font-weight:600;">${v.name}</div>
        <div style="font-size:var(--text-xs);color:var(--gray-400);">${v.category} · ${v.date}</div>
      </div>
      <div style="display:flex;gap:var(--sp-2);">
        <button class="btn btn-danger btn-sm" onclick="adminVerif('${v._recordId}','rejected',this)" style="padding:3px 10px;font-size:11px;">✗</button>
        <button class="btn btn-success btn-sm" onclick="adminVerif('${v._recordId}','approved',this)" style="padding:3px 10px;font-size:11px;">✓</button>
      </div>
    </div>`).join('');
}

/* ── Full verifications list ────────────── */
function loadVerificationsList() {
  const el = document.getElementById('verificationsList');
  if (!el) return;
  if (!adminVerifications.length) {
    el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-shield-check"></i><h3>Sin verificaciones</h3></div>';
    return;
  }
  el.innerHTML = adminVerifications.map(v => `
    <div class="approval-card ${v.status === 'pending' ? 'new' : ''}" id="verif-${v._recordId}">
      <div style="display:flex;align-items:flex-start;gap:var(--sp-4);flex-wrap:wrap;">
        <img src="${v.avatar}" class="avatar avatar-lg" />
        <div style="flex:1;min-width:200px;">
          <div style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--sp-1);">${v.name}</div>
          <div style="font-size:var(--text-sm);color:var(--gray-500);margin-bottom:var(--sp-3);">${v.category} · Solicitado: ${v.date}</div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-2);">
            <span class="badge ${v.status === 'pending' ? 'badge-yellow' : v.status === 'approved' ? 'badge-green' : 'badge-red'}">
              ${v.status === 'pending' ? '⏳ Pendiente' : v.status === 'approved' ? '✓ Aprobado' : '✗ Rechazado'}
            </span>
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            ${v.documents && v.documents.length
  ? v.documents.map(doc => `
    <a href="${doc.url}" target="_blank" title="Ver ${doc.filename || 'documento'}"
       style="display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2) var(--sp-3);background:var(--gray-50);border-radius:var(--radius-lg);font-size:var(--text-xs);cursor:pointer;text-decoration:none;color:inherit;border:1px solid var(--gray-200);">
      <i class="fa-solid fa-file-image" style="color:var(--color-primary);"></i>
      ${doc.filename || 'documento'}
      <i class="fa-solid fa-arrow-up-right-from-square" style="color:var(--gray-400);margin-left:auto;"></i>
    </a>`).join('')
  : v.docs.length
    ? v.docs.map(d => `<span style="padding:var(--sp-1) var(--sp-2);background:var(--gray-100);border-radius:var(--radius-md);font-size:var(--text-xs);">${d}</span>`).join('')
    : '<span style="font-size:var(--text-xs);color:var(--gray-400);">Sin documentos adjuntos</span>'}
          </div>
        </div>
        ${v.status === 'pending' ? `
        <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
          <button class="btn btn-success" onclick="adminVerif('${v._recordId}','approved',this)">
            <i class="fa-solid fa-check"></i> Aprobar
          </button>
          <button class="btn btn-danger" onclick="adminVerif('${v._recordId}','rejected',this)">
            <i class="fa-solid fa-xmark"></i> Rechazar
          </button>
          <button class="btn btn-ghost btn-sm" onclick="VOY.showToast('Solicitar más info próximamente','info')">
            Pedir más info
          </button>
        </div>` : ''}
      </div>
      <div style="font-size:var(--text-xs);color:var(--gray-400);margin-top:var(--sp-3);">Ref. ${v.id}</div>
    </div>`).join('');
}

async function adminVerif(recordId, action, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    await VoyDB.updateVerification(recordId, action);

    // Actualizar cache local
    const idx = adminVerifications.findIndex(v => v._recordId === recordId);
    if (idx !== -1) adminVerifications[idx].status = action;

    const name = adminVerifications.find(v => v._recordId === recordId)?.name;
    if (action === 'approved') {
      VOY.showToast(`✅ ${name} verificado correctamente`, 'success');
    } else {
      VOY.showToast(`Verificación de ${name} rechazada`, 'error');
    }

    const card = document.getElementById(`verif-${recordId}`);
    if (card) {
      card.classList.remove('new');
      card.style.opacity = action === 'approved' ? '0.7' : '0.4';
    }

    // Actualizar preview
    loadPendingVerifPreview();

    // Actualizar badge sidebar
    const pendingCount = adminVerifications.filter(v => v.status === 'pending').length;
    setEl('verifBadge', pendingCount > 0 ? pendingCount : '');

  } catch (e) {
    VOY.showToast('Error al procesar verificación', 'error');
    if (btn) { btn.disabled = false; btn.textContent = action === 'approved' ? 'Aprobar' : 'Rechazar'; }
  }
}

/* ── Recent transactions ─────────────────── */
function loadRecentTransactions() {
  const el = document.getElementById('recentTransactions');
  if (!el) return;
  const recent = adminTransactions.slice(0, 5);
  if (!recent.length) {
    el.innerHTML = '<div style="padding:var(--sp-4);text-align:center;color:var(--gray-400);">Sin transacciones</div>';
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Ref.</th><th>Cliente</th><th>Servicio</th><th>Total</th><th>Estado</th></tr></thead>
      <tbody>
        ${recent.map(t => `
        <tr>
          <td><code style="font-size:var(--text-xs);background:var(--gray-100);padding:2px 6px;border-radius:4px;">${t.id}</code></td>
          <td>${t.client}</td>
          <td>${t.svc} · ${t.worker}</td>
          <td style="font-weight:600;color:var(--color-primary);">${VOY.formatCLP(t.gross)}</td>
          <td><span class="badge ${t.status === 'completed' ? 'badge-green' : t.status === 'pending' ? 'badge-yellow' : 'badge-red'}">${t.status === 'completed' ? 'Completado' : t.status === 'pending' ? 'Pendiente' : 'Devuelto'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── Users table ────────────────────────── */
function loadUsersTable(filter = 'all') {
  const el = document.getElementById('usersTable');
  if (!el) return;

  const clients = VOY_DATA.clients.map(c => ({ ...c, role: 'cliente' }));
  const workers = VOY_DATA.workers.map(w => ({
    _recordId: w._recordId,
    id: w.id + 200, name: w.name, avatar: w.avatar, city: w.city,
    memberSince: '2025-01', totalServices: w.completedJobs, role: 'profesional',
    category: w.categoryLabel, verified: w.verified, rating: w.rating,
  }));
  const users = [...clients, ...workers].filter(u => filter === 'all' || u.role === filter);

  el.innerHTML = `
    <thead>
      <tr>
        <th>Usuario</th><th>Rol</th><th>Ciudad</th><th>Miembro desde</th>
        <th>Servicios</th><th>Estado</th><th>Acción</th>
      </tr>
    </thead>
    <tbody>
      ${users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--sp-3);">
            <img src="${u.avatar}" class="avatar avatar-xs" />
            <div>
              <div style="font-weight:600;">${u.name}</div>
              ${u.category ? `<div style="font-size:var(--text-xs);color:var(--gray-400);">${u.category}</div>` : ''}
            </div>
          </div>
        </td>
        <td><span class="badge ${u.role === 'profesional' ? 'badge-blue' : 'badge-gray'}">${u.role}</span></td>
        <td>${u.city}</td>
        <td>${u.memberSince}</td>
        <td>${u.totalServices}</td>
        <td>
          ${u.role === 'profesional'
            ? `<span class="badge ${u.verified ? 'badge-green' : 'badge-yellow'}">${u.verified ? '✓ Verificado' : '! Pendiente'}</span>`
            : '<span class="badge badge-green">Activo</span>'}
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="VOY.showToast('Vista de usuario próximamente','info')">Ver</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="confirmSuspend('${u.name}')">Suspender</button>
        </td>
      </tr>`).join('')}
    </tbody>`;
}

function filterUsers(val) { loadUsersTable(val); }

function confirmSuspend(name) {
  if (confirm(`¿Suspender a ${name}? Esta acción requiere confirmación.`)) {
    VOY.showToast(`${name} suspendido`, 'warning');
  }
}

/* ── Transactions table ─────────────────── */
function loadTransTable() {
  const el = document.getElementById('transTable');
  if (!el) return;

  // Combinar transacciones de Airtable + bookings completados
  const bookingTxs = VOY_DATA.bookings
    .filter(b => b.status === 'completed')
    .map(b => {
      const w = VOY_DATA.workers.find(x => x.id === b.workerId);
      const c = VOY_DATA.clients.find(x => x.id === b.clientId);
      return { id: b.id, date: b.date, client: c?.name || 'Cliente', worker: w?.name || 'Profesional', svc: b.category, gross: b.price, status: 'completed' };
    });

  const all = [...adminTransactions, ...bookingTxs]
    .sort((a,b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 20);

  const statusMap = {
    completed: { label: 'Completado', cls: 'badge-green' },
    pending:   { label: 'Pendiente',  cls: 'badge-yellow' },
    refunded:  { label: 'Devuelto',   cls: 'badge-red' },
  };

  el.innerHTML = `
    <thead>
      <tr><th>Ref.</th><th>Fecha</th><th>Cliente</th><th>Profesional</th><th>Servicio</th><th>Total</th><th>Comisión</th><th>Estado</th></tr>
    </thead>
    <tbody>
      ${all.map(t => {
        const st = statusMap[t.status] || statusMap.completed;
        return `<tr>
          <td><code style="font-size:var(--text-xs);background:var(--gray-100);padding:2px 6px;border-radius:4px;">${t.id}</code></td>
          <td>${t.date}</td>
          <td>${t.client}</td>
          <td>${t.worker}</td>
          <td>${t.svc}</td>
          <td style="font-weight:700;">${VOY.formatCLP(t.gross)}</td>
          <td style="color:var(--color-success);font-weight:600;">+${VOY.formatCLP(Math.round(t.gross*0.15))}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
        </tr>`;
      }).join('')}
    </tbody>`;
}

/* ── Categories admin ───────────────────── */
function loadCategoriesAdmin() {
  const el = document.getElementById('categoriesAdmin');
  if (!el) return;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--sp-4);">
      ${VOY_DATA.categories.map(cat => {
        const count = VOY_DATA.workers.filter(w => w.category === cat.id).length;
        const bookingCount = VOY_DATA.bookings.filter(b => b.category === cat.id).length;
        return `
        <div class="card">
          <div class="card-body" style="display:flex;align-items:center;gap:var(--sp-4);">
            <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:${cat.bg};color:${cat.color};display:flex;align-items:center;justify-content:center;font-size:var(--text-xl);flex-shrink:0;">
              <i class="fa-solid ${cat.icon}"></i>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;">${cat.label}</div>
              <div style="font-size:var(--text-xs);color:var(--gray-400);">${count} profesionales · ${bookingCount} reservas</div>
            </div>
            <div style="display:flex;gap:var(--sp-2);">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="VOY.showToast('Editar categoría próximamente','info')"><i class="fa-solid fa-pencil"></i></button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/* ── Config ─────────────────────────────── */
function loadConfigView() {
  const el = document.getElementById('configView');
  if (!el) return;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-6);">
      <div class="card">
        <div class="card-header"><strong>Configuración general</strong></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--sp-4);">
          <div class="input-group"><label class="input-label">Nombre de la plataforma</label><input class="input" value="VOY" /></div>
          <div class="input-group"><label class="input-label">Comisión estándar (%)</label><input class="input" type="number" value="15" /></div>
          <div class="input-group"><label class="input-label">Comisión verificados (%)</label><input class="input" type="number" value="12" /></div>
          <div class="input-group"><label class="input-label">Radio máximo de búsqueda (km)</label><input class="input" type="number" value="50" /></div>
          <button class="btn btn-primary" onclick="VOY.showToast('Configuración guardada','success')">
            <i class="fa-solid fa-check"></i> Guardar cambios
          </button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><strong>Estado de la plataforma</strong></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--sp-4);">
          ${[
            { label: 'Registro de clientes',       on: true  },
            { label: 'Registro de profesionales',  on: true  },
            { label: 'Pagos online',               on: true  },
            { label: 'Notificaciones email',        on: true  },
            { label: 'Notificaciones push',         on: false },
            { label: 'Modo mantenimiento',          on: false },
          ].map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:var(--text-sm);color:var(--gray-700);">${s.label}</span>
            <label class="toggle">
              <input type="checkbox" ${s.on ? 'checked' : ''} onchange="VOY.showToast('Configuración actualizada','info')" />
              <span class="toggle-slider"></span>
            </label>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ── View switcher ──────────────────────── */
function showView(name, el) {
  document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.remove('hidden');
  if (el) el.classList.add('active');

  // Los IDs en el HTML son: overview, verificaciones, usuarios, transacciones, categorias, configuracion
  if (name === 'verificaciones') loadVerificationsList();
  if (name === 'usuarios')       loadUsersTable();
  if (name === 'transacciones')  loadTransTable();
  if (name === 'categorias')     loadCategoriesAdmin();
  if (name === 'configuracion')  loadConfigView();
}

/* ── Logout ─────────────────────────────── */
function logout() {
  VoyAuth.logout();
}
