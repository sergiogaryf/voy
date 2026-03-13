/* ============================================
   VOY — Admin App Logic (Airtable conectado)
   ============================================ */

let adminVerifications = [];
let adminTransactions  = [];

const PAGE_SIZE = 10;
let usersPage = 1;
let transPage = 1;

/* ── Paginación helper ───────────────────── */
function renderPagination(containerId, currentPage, totalItems, onPageChange) {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) return '';
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3) var(--sp-4);border-top:1px solid var(--gray-100);background:white;">
      <span style="font-size:var(--text-xs);color:var(--gray-400);">
        Mostrando ${Math.min((currentPage-1)*PAGE_SIZE+1, totalItems)}–${Math.min(currentPage*PAGE_SIZE, totalItems)} de ${totalItems}
      </span>
      <div style="display:flex;gap:var(--sp-1);">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="${onPageChange}(${currentPage-1})" ${currentPage===1?'disabled':''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        ${pages.map(p => p === '...'
          ? `<span style="padding:var(--sp-1) var(--sp-2);color:var(--gray-400);">…</span>`
          : `<button class="btn btn-${p===currentPage?'primary':'ghost'} btn-sm" onclick="${onPageChange}(${p})" style="min-width:32px;">${p}</button>`
        ).join('')}
        <button class="btn btn-ghost btn-sm btn-icon" onclick="${onPageChange}(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>`;
}

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
    console.error(e);
    VOY.showAppError('Error cargando panel', e.message || 'No se pudo conectar con Airtable.');
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
  // Subtitle dinámico
  const now = new Date();
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const subtitleEl = document.getElementById('adminSubtitle');
  if (subtitleEl) subtitleEl.textContent = `Quinta Región Beta · ${months[now.getMonth()]} ${now.getFullYear()}`;
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
  const verifBadge = document.getElementById('verifBadge');
  if (verifBadge) {
    verifBadge.textContent = pending;
    verifBadge.style.display = pending > 0 ? '' : 'none';
  }
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

  const clients = VOY_DATA.clients.map(c => ({
    _recordId: c._recordId, id: c.id, name: c.name, avatar: c.avatar,
    city: c.city, memberSince: c.memberSince, totalServices: c.totalServices,
    role: 'cliente', category: '', verified: false, rating: c.rating || 0,
    status: c.status || 'active',
  }));
  const workers = VOY_DATA.workers.map(w => ({
    _recordId: w._recordId, id: w.id, name: w.name, avatar: w.avatar,
    city: w.city, memberSince: '2025-01', totalServices: w.completedJobs,
    role: 'profesional', category: w.categoryLabel, verified: w.verified, rating: w.rating,
    status: w.status || 'active',
  }));
  const users = [...clients, ...workers].filter(u => filter === 'all' || u.role === filter);

  const start    = (usersPage - 1) * PAGE_SIZE;
  const pageUsers = users.slice(start, start + PAGE_SIZE);

  // Obtener valores únicos para filtros
  const cities = [...new Set(users.map(u => u.city).filter(Boolean))].sort();
  const statuses = [...new Set(users.map(u => u.status || 'active').filter(Boolean))];

  el.innerHTML = `
    <thead>
      <tr>
        <th>Usuario</th><th>Rol</th><th>Ciudad</th><th>Miembro desde</th>
        <th>Servicios</th><th>Estado</th><th>Acción</th>
      </tr>
      <tr style="background:var(--gray-50);">
        <th><input type="text" placeholder="Buscar..." id="filterName" oninput="applyTableFilters()" style="width:100%;padding:4px 8px;border:1px solid var(--gray-200);border-radius:6px;font-size:12px;"></th>
        <th><select id="filterRole" onchange="applyTableFilters()" style="width:100%;padding:4px;border:1px solid var(--gray-200);border-radius:6px;font-size:12px;">
          <option value="">Todos</option><option value="cliente">Cliente</option><option value="profesional">Profesional</option>
        </select></th>
        <th><select id="filterCity" onchange="applyTableFilters()" style="width:100%;padding:4px;border:1px solid var(--gray-200);border-radius:6px;font-size:12px;">
          <option value="">Todas</option>${cities.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select></th>
        <th></th>
        <th></th>
        <th><select id="filterStatus" onchange="applyTableFilters()" style="width:100%;padding:4px;border:1px solid var(--gray-200);border-radius:6px;font-size:12px;">
          <option value="">Todos</option><option value="active">Activo</option><option value="suspended">Suspendido</option>
        </select></th>
        <th></th>
      </tr>
    </thead>
    <tbody id="usersBody">
      ${pageUsers.map(u => `
      <tr id="userRow_${u._recordId}">
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
        <td id="userStatus_${u._recordId}">
          <span class="badge ${u.status === 'suspended' ? 'badge-red' : u.role === 'profesional' && u.verified ? 'badge-green' : 'badge-yellow'}">
            ${u.status === 'suspended' ? '⛔ Suspendido' : u.role === 'profesional' ? (u.verified ? '✓ Verificado' : '! Pendiente') : '✓ Activo'}
          </span>
        </td>
        <td style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" style="color:${u.status === 'suspended' ? 'var(--color-success)' : 'var(--color-danger)'};"
            onclick="toggleSuspend('${u._recordId}','${u.role === 'profesional' ? 'Workers' : 'Clients'}','${u.name}','${u.status}', this)">
            ${u.status === 'suspended' ? 'Reactivar' : 'Suspender'}
          </button>
          <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);"
            onclick="deleteUser('${u._recordId}','${u.role === 'profesional' ? 'Workers' : 'Clients'}','${u.name}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>`).join('')}
    </tbody>`;

  // Agregar paginación después de la tabla (en el contenedor padre)
  const paginationId = 'usersPagination';
  let pEl = document.getElementById(paginationId);
  if (!pEl) {
    pEl = document.createElement('div');
    pEl.id = paginationId;
    el.parentNode.insertAdjacentElement('afterend', pEl);
  }
  pEl.innerHTML = renderPagination(paginationId, usersPage, users.length, 'setUsersPage');
  // Guardar users para reusar en cambio de página
  window._usersCache = users;
}

function setUsersPage(page) {
  const total = window._usersCache?.length || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  usersPage = Math.max(1, Math.min(page, totalPages));
  const filter = document.querySelector('.sidebar-link.active')?.textContent?.includes('Clientes') ? 'cliente' : 'all';
  loadUsersTable();
}

function filterUsers(val) {
  usersPage = 1;
  loadUsersTable(val);
}

async function toggleSuspend(recordId, table, name, currentStatus, btn) {
  const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
  const action    = newStatus === 'suspended' ? 'suspender' : 'reactivar';
  if (!confirm(`¿Deseas ${action} a ${name}?`)) return;

  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    await VoyDB.updateUserStatus(table, recordId, newStatus);
    VOY.showToast(`${name} ${newStatus === 'suspended' ? 'suspendido' : 'reactivado'}`, newStatus === 'suspended' ? 'warning' : 'success');
    // Actualizar la UI sin recargar toda la tabla
    const statusCell = document.getElementById(`userStatus_${recordId}`);
    if (statusCell) {
      statusCell.innerHTML = newStatus === 'suspended'
        ? '<span class="badge badge-red">⛔ Suspendido</span>'
        : '<span class="badge badge-green">✓ Activo</span>';
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = newStatus === 'suspended' ? 'Reactivar' : 'Suspender';
      btn.style.color = newStatus === 'suspended' ? 'var(--color-success)' : 'var(--color-danger)';
      btn.setAttribute('onclick', `toggleSuspend('${recordId}','${table}','${name}','${newStatus}',this)`);
    }
  } catch (e) {
    VOY.showToast('Error al actualizar estado', 'error');
    if (btn) { btn.disabled = false; btn.textContent = currentStatus === 'suspended' ? 'Reactivar' : 'Suspender'; }
  }
}

/* ── Filtros de cabecera en tabla ──────── */
function applyTableFilters() {
  const nameQ  = (document.getElementById('filterName')?.value || '').toLowerCase();
  const roleQ  = document.getElementById('filterRole')?.value || '';
  const cityQ  = document.getElementById('filterCity')?.value || '';
  const statusQ = document.getElementById('filterStatus')?.value || '';

  const rows = document.querySelectorAll('#usersBody tr[id^="userRow_"]');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    const name   = (cells[0]?.textContent || '').toLowerCase();
    const role   = (cells[1]?.textContent || '').toLowerCase().trim();
    const city   = (cells[2]?.textContent || '').trim();
    const status = row.querySelector('.badge-red') ? 'suspended' : 'active';

    const show = (!nameQ || name.includes(nameQ))
      && (!roleQ || role.includes(roleQ))
      && (!cityQ || city === cityQ)
      && (!statusQ || status === statusQ);

    row.style.display = show ? '' : 'none';
  });
}

/* ── Eliminar usuario ──────────────────── */
async function deleteUser(recordId, table, name) {
  if (!confirm(`¿Estás seguro de eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
  try {
    await VoyDB.deleteRecord(table, recordId);
    VOY.showToast(`${name} eliminado`, 'success');
    // Quitar la fila de la tabla
    const row = document.getElementById(`userRow_${recordId}`);
    if (row) row.remove();
    // Actualizar datos locales
    if (table === 'Clients') {
      VOY_DATA.clients = VOY_DATA.clients.filter(c => c._recordId !== recordId);
    } else {
      VOY_DATA.workers = VOY_DATA.workers.filter(w => w._recordId !== recordId);
    }
  } catch (e) {
    VOY.showToast('Error al eliminar: ' + (e.message || ''), 'error');
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

  const allSorted = [...adminTransactions, ...bookingTxs]
    .sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  const all = allSorted.slice((transPage - 1) * PAGE_SIZE, transPage * PAGE_SIZE);

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
          <td style="font-family:monospace;font-size:var(--text-xs);">${t.id}</td>
          <td>${t.date}</td>
          <td>${t.client}</td>
          <td>${t.worker}</td>
          <td>${t.svc}</td>
          <td style="font-weight:600;">${VOY.formatCLP(t.gross)}</td>
          <td style="color:var(--gray-400);">${VOY.formatCLP(Math.round(t.gross * 0.15))}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
        </tr>`;
      }).join('')}
    </tbody>`;

  // Paginación de transacciones
  const tPagId = 'transPagination';
  let tPEl = document.getElementById(tPagId);
  if (!tPEl) {
    tPEl = document.createElement('div');
    tPEl.id = tPagId;
    el.parentNode.insertAdjacentElement('afterend', tPEl);
  }
  tPEl.innerHTML = renderPagination(tPagId, transPage, allSorted.length, 'setTransPage');
  window._transTotalCount = allSorted.length;
}

function setTransPage(page) {
  const total = window._transTotalCount || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  transPage = Math.max(1, Math.min(page, totalPages));
  loadTransTable();
}

/* ── Categories admin ───────────────────── */
function loadCategoriesAdmin() {
  const el = document.getElementById('categoriesAdmin');
  if (!el) return;

  // Cargar overrides de localStorage
  const overrides = JSON.parse(localStorage.getItem('voy_cat_overrides') || '{}');
  const cats = VOY_DATA.categories.map(cat => ({
    ...cat,
    label: overrides[cat.id]?.label || cat.label,
    icon:  overrides[cat.id]?.icon  || cat.icon,
  }));

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--sp-4);" id="catGrid">
      ${cats.map(cat => {
        const count        = VOY_DATA.workers.filter(w => w.category === cat.id).length;
        const bookingCount = VOY_DATA.bookings.filter(b => b.category === cat.id).length;
        return `
        <div class="card" id="catCard_${cat.id}">
          <div class="card-body" style="display:flex;align-items:center;gap:var(--sp-4);">
            <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:${cat.bg};color:${cat.color};display:flex;align-items:center;justify-content:center;font-size:var(--text-xl);flex-shrink:0;">
              <i class="fa-solid ${cat.icon}"></i>
            </div>
            <div style="flex:1;">
              <div style="font-weight:700;" id="catLabel_${cat.id}">${cat.label}</div>
              <div style="font-size:var(--text-xs);color:var(--gray-400);">${count} profesionales · ${bookingCount} reservas</div>
            </div>
            <div style="display:flex;gap:var(--sp-2);">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="toggleCatEdit('${cat.id}','${cat.label}','${cat.icon}')">
                <i class="fa-solid fa-pencil"></i>
              </button>
            </div>
          </div>
          <div id="catEdit_${cat.id}" style="display:none;padding:var(--sp-3) var(--sp-4);border-top:1px solid var(--gray-100);background:var(--gray-50);">
            <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);">
              <input class="input" id="catInputLabel_${cat.id}" placeholder="Nombre" value="${cat.label}" style="flex:2;" />
              <input class="input" id="catInputIcon_${cat.id}" placeholder="fa-xxx" value="${cat.icon}" style="flex:1;" />
            </div>
            <div style="display:flex;gap:var(--sp-2);">
              <button class="btn btn-primary btn-sm" onclick="saveCatEdit('${cat.id}')">
                <i class="fa-solid fa-check"></i> Guardar
              </button>
              <button class="btn btn-ghost btn-sm" onclick="toggleCatEdit('${cat.id}')">Cancelar</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function toggleCatEdit(catId, label, icon) {
  const panel = document.getElementById(`catEdit_${catId}`);
  if (!panel) return;
  const isVisible = panel.style.display !== 'none';
  panel.style.display = isVisible ? 'none' : 'block';
}

function saveCatEdit(catId) {
  const newLabel = document.getElementById(`catInputLabel_${catId}`)?.value.trim();
  const newIcon  = document.getElementById(`catInputIcon_${catId}`)?.value.trim();
  if (!newLabel) return;

  // Guardar en localStorage
  const overrides = JSON.parse(localStorage.getItem('voy_cat_overrides') || '{}');
  overrides[catId] = { label: newLabel, icon: newIcon || 'fa-tag' };
  localStorage.setItem('voy_cat_overrides', JSON.stringify(overrides));

  // Actualizar la UI sin recargar
  const labelEl = document.getElementById(`catLabel_${catId}`);
  if (labelEl) labelEl.textContent = newLabel;
  toggleCatEdit(catId);
  VOY.showToast('Categoría actualizada', 'success');
}

/* ── Config ─────────────────────────────── */
const CONFIG_KEY = 'voy_admin_config';

function getAdminConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; }
  catch { return {}; }
}

function saveAdminConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function loadConfigView() {
  const el = document.getElementById('configView');
  if (!el) return;
  const cfg = getAdminConfig();

  const toggles = [
    { key: 'clientRegistration',  label: 'Registro de clientes',      default: true  },
    { key: 'workerRegistration',  label: 'Registro de profesionales',  default: true  },
    { key: 'onlinePayments',      label: 'Pagos online',               default: true  },
    { key: 'emailNotifications',  label: 'Notificaciones email',       default: true  },
    { key: 'pushNotifications',   label: 'Notificaciones push',        default: false },
    { key: 'maintenanceMode',     label: 'Modo mantenimiento',         default: false },
  ];

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-6);">
      <div class="card">
        <div class="card-header"><strong>Configuración general</strong></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--sp-4);">
          <div class="input-group">
            <label class="input-label">Nombre de la plataforma</label>
            <input class="input" id="cfgName" value="${cfg.name || 'VOY'}" />
          </div>
          <div class="input-group">
            <label class="input-label">Comisión estándar (%)</label>
            <input class="input" id="cfgCommission" type="number" min="0" max="50" value="${cfg.commission || 15}" />
          </div>
          <div class="input-group">
            <label class="input-label">Comisión verificados (%)</label>
            <input class="input" id="cfgCommissionVerified" type="number" min="0" max="50" value="${cfg.commissionVerified || 12}" />
          </div>
          <div class="input-group">
            <label class="input-label">Radio máximo de búsqueda (km)</label>
            <input class="input" id="cfgRadius" type="number" min="1" max="200" value="${cfg.radius || 50}" />
          </div>
          <button class="btn btn-primary" onclick="saveConfig()">
            <i class="fa-solid fa-check"></i> Guardar cambios
          </button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><strong>Estado de la plataforma</strong></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--sp-4);">
          ${toggles.map(t => `
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:var(--text-sm);color:var(--gray-700);">${t.label}</span>
            <label class="toggle">
              <input type="checkbox" id="cfg_${t.key}" ${(cfg[t.key] !== undefined ? cfg[t.key] : t.default) ? 'checked' : ''}
                onchange="saveToggleConfig('${t.key}', this.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function saveConfig() {
  const cfg = getAdminConfig();
  cfg.name               = document.getElementById('cfgName')?.value || 'VOY';
  cfg.commission         = Number(document.getElementById('cfgCommission')?.value) || 15;
  cfg.commissionVerified = Number(document.getElementById('cfgCommissionVerified')?.value) || 12;
  cfg.radius             = Number(document.getElementById('cfgRadius')?.value) || 50;
  saveAdminConfig(cfg);
  VOY.showToast('Configuración guardada', 'success');
}

function saveToggleConfig(key, value) {
  const cfg = getAdminConfig();
  cfg[key] = value;
  saveAdminConfig(cfg);
  VOY.showToast('Configuración actualizada', 'success');
}

/* ── View switcher ──────────────────────── */
function showView(name, el) {
  document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.remove('hidden');
  const activeLink = el || document.querySelector(`.sidebar-link[onclick*="'${name}'"]`);
  if (activeLink) activeLink.classList.add('active');

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
