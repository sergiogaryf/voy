/* ============================================
   VOY — Client App Logic (Airtable conectado)
   ============================================ */

let map, markers = [], selectedWorker = null;
let favorites = VoyDB.getFavorites();
let currentCategory = 'all', currentRadius = 10, listView = 'list';
let clientSession = null;
let clientData    = null;

/* ── Init ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión — redirige a /login/ si no hay sesión de cliente
  clientSession = VoyAuth.requireRole('cliente');
  if (!clientSession) return;

  buildCategoryChips();
  initMap();
  showLoadingState();

  try {
    await VOY_DATA.init();
    // Cargar datos del cliente logueado
    clientData = await VoyDB.getClientByEmail(clientSession.email);
    // Mostrar info de sesión en topbar
    VoyAuth.applySessionToUI(clientSession);
    filterWorkers();
    loadActiveServices();
    updateActiveBadge();
    loadHistorial();
    loadClientProfile();
    loadPagos();
    loadFavorites();
    loadNotifications();
    handleURLParams();
    setTodayDate();
  } catch (e) {
    console.error(e);
    VOY.showError('providersList', 'Error cargando datos. Verifica tu conexión.', 'location.reload');
    VOY.showAppError('Error de conexión', e.message || 'No se pudo cargar la información.');
  }
});

/* ── Cambiar foto de perfil (cliente) ────── */
async function handleClientAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { VOY.showToast('La imagen no debe superar 5MB', 'error'); return; }

  VOY.showToast('Subiendo foto...', 'info');
  try {
    const avatarFieldId = 'fldz86ldJpFRy85yS';
    const recordId = clientData?._recordId || clientSession?.recordId;
    if (!recordId) throw new Error('No hay registro de cliente');
    const newUrl = await VoyDB.uploadAvatar('Clients', recordId, avatarFieldId, file);
    if (newUrl) {
      if (clientData) clientData.avatar = newUrl;
      document.querySelectorAll('.session-avatar').forEach(el => el.src = newUrl);
      const img = document.getElementById('clientAvatarImg');
      if (img) img.src = newUrl;
      VOY.showToast('Foto actualizada correctamente', 'success');
    }
  } catch (e) {
    console.error('Error subiendo avatar:', e);
    VOY.showToast('Error al subir la foto. Intenta de nuevo.', 'error');
  }
}

/* ── Logout ─────────────────────────────── */
function logout() {
  VoyAuth.logout();
}

function showLoadingState() {
  VOY.showLoading('providersList', 'Cargando profesionales...');
}

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  const d = document.getElementById('bookingDate');
  if (d) { d.value = today; d.min = today; }
}

function handleURLParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('cat')) { currentCategory = p.get('cat'); filterWorkers(); }
  if (p.get('worker')) openWorkerDetail(parseInt(p.get('worker')));
}

/* ── Category chips ─────────────────────── */
function buildCategoryChips() {
  const el = document.getElementById('filterCats');
  VOY_DATA.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-chip';
    btn.dataset.cat = cat.id;
    btn.innerHTML = `<i class="fa-solid ${cat.icon}"></i> ${cat.label}`;
    btn.onclick = () => setCategory(cat.id, btn);
    el.appendChild(btn);
  });
}

function setCategory(catId, el) {
  currentCategory = catId;
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filterWorkers();
}

/* ── Filter & sort ──────────────────────── */
function updateRadius(val) {
  currentRadius = parseInt(val);
  document.getElementById('radiusLabel').textContent = `${val} km`;
  filterWorkers();
}

function filterWorkers() {
  const search    = document.getElementById('mainSearch')?.value.toLowerCase() ?? '';
  const sort      = document.getElementById('sortSelect')?.value ?? 'distance';
  const onlyAvail = document.getElementById('onlyAvailable')?.checked ?? true;
  const onlyVerif = document.getElementById('onlyVerified')?.checked ?? false;

  let workers = VOY_DATA.workers.filter(w => {
    if (onlyAvail && !w.available) return false;
    if (onlyVerif && !w.verified) return false;
    if (currentCategory !== 'all' && w.category !== currentCategory) return false;
    if (w.distance > currentRadius) return false;
    if (search && !w.name.toLowerCase().includes(search) && !w.categoryLabel.toLowerCase().includes(search)) return false;
    return true;
  });

  workers.sort((a, b) => {
    if (sort === 'distance') return a.distance - b.distance;
    if (sort === 'rating')   return b.rating - a.rating;
    if (sort === 'price')    return a.priceMin - b.priceMin;
    return 0;
  });

  document.getElementById('resultsCount').textContent =
    `${workers.length} profesional${workers.length !== 1 ? 'es' : ''} encontrado${workers.length !== 1 ? 's' : ''}`;

  renderProvidersList(workers);
  updateMapMarkers(workers);
}

/* ── Providers list ─────────────────────── */
function renderProvidersList(workers) {
  const el = document.getElementById('providersList');
  if (!el) return;

  if (workers.length === 0) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Sin resultados</h3><p>Intenta ampliar el radio de búsqueda o cambiar la categoría.</p></div>`;
    return;
  }

  el.innerHTML = workers.map(w => {
    const cat = VOY.getCategoryById(w.category);
    const isFav = favorites.has(w.id);
    return `
    <div class="provider-card ${selectedWorker?.id === w.id ? 'selected' : ''}" onclick="openWorkerDetail(${w.id})" id="pcard-${w.id}">
      <div style="position:relative;">
        <img src="${w.avatar}" alt="${w.name}" class="avatar avatar-md" />
        <span class="status-dot ${w.available ? 'online' : 'offline'}" style="position:absolute; bottom:2px; right:2px;"></span>
      </div>
      <div class="provider-card-body">
        <div style="display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-1);">
          <span class="provider-card-name">${w.name}</span>
          ${w.verified ? '<i class="fa-solid fa-circle-check" style="color:var(--color-primary); font-size:var(--text-sm);" title="Verificado"></i>' : ''}
          ${isFav ? '<i class="fa-solid fa-heart" style="color:#ef4444; font-size:var(--text-sm);"></i>' : ''}
        </div>
        <span class="badge badge-blue" style="background:${cat.bg}; color:${cat.color}; margin-bottom:var(--sp-2);">
          <i class="fa-solid ${cat.icon}"></i> ${w.categoryLabel}
        </span>
        <div class="provider-card-meta">
          <span><i class="fa-solid fa-star" style="color:var(--color-warning);"></i> ${w.rating} (${w.reviews})</span>
          <span><i class="fa-solid fa-location-dot"></i> ${VOY.formatDistance(w.distance)}</span>
          <span><i class="fa-solid fa-clock"></i> ${w.responseTime}</span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:var(--sp-2);">
          <span class="provider-card-price">Desde ${VOY.formatCLP(w.priceMin)} / ${w.priceUnit}</span>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); quickBook(${w.id})">
            Contratar
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setListView(v) {
  listView = v;
  document.getElementById('tabList').classList.toggle('active', v === 'list');
  document.getElementById('tabGrid').classList.toggle('active', v === 'grid');
}

/* ── Map ────────────────────────────────── */
function initMap() {
  const el = document.getElementById('mapContainer');
  if (!el) return;
  el.innerHTML = '<div id="map"></div>';

  map = L.map('map', { zoomControl: true }).setView([-33.025, -71.552], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const userIcon = L.divIcon({
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.5);"></div>',
    iconSize: [16, 16], iconAnchor: [8, 8], className: '',
  });
  L.marker([-33.022, -71.548], { icon: userIcon })
    .addTo(map)
    .bindPopup('<strong>Tu ubicación</strong>');
}

function updateMapMarkers(workers) {
  if (!map) return;
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  workers.forEach(w => {
    const cat = VOY.getCategoryById(w.category);
    const icon = L.divIcon({
      html: `<div style="width:36px;height:36px;border-radius:50%;background:${cat.color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;"><i class="fa-solid ${cat.icon}"></i></div>`,
      iconSize: [36, 36], iconAnchor: [18, 18], className: '',
    });

    const m = L.marker([w.lat, w.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div class="map-worker-popup">
          <div class="popup-name">${w.name} ${w.verified ? '✓' : ''}</div>
          <div class="popup-cat">${w.categoryLabel} · ${VOY.formatDistance(w.distance)}</div>
          <div class="popup-row">
            <span>⭐ ${w.rating}</span>
            <span>Desde ${VOY.formatCLP(w.priceMin)}</span>
          </div>
          <br/>
          <button onclick="openWorkerDetail(${w.id})" style="width:100%;padding:6px;background:#2563EB;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;">Ver perfil</button>
        </div>
      `);
    m.on('click', () => openWorkerDetail(w.id));
    markers.push(m);
  });
}

/* ── Worker detail ──────────────────────── */
function openWorkerDetail(id) {
  selectedWorker = VOY_DATA.workers.find(w => w.id === id);
  if (!selectedWorker) return;

  document.getElementById('detailWorkerName').textContent = selectedWorker.name;
  const isFav = favorites.has(id);
  const favBtn = document.getElementById('btnFavorite');
  favBtn.innerHTML = isFav ? '<i class="fa-solid fa-heart" style="color:#ef4444;"></i>' : '<i class="fa-regular fa-heart"></i>';

  const cat = VOY.getCategoryById(selectedWorker.category);

  document.getElementById('workerDetailBody').innerHTML = `
    <div style="text-align:center; padding: var(--sp-5) 0; border-bottom:1px solid var(--gray-100); margin-bottom:var(--sp-5);">
      <div style="position:relative; display:inline-block; margin-bottom:var(--sp-4);">
        <img src="${selectedWorker.avatar}" alt="${selectedWorker.name}" class="avatar avatar-xl" style="width:88px;height:88px;" />
        <span class="status-dot ${selectedWorker.available ? 'online' : 'offline'}" style="position:absolute; bottom:4px; right:4px; width:14px; height:14px; border:3px solid white;"></span>
      </div>
      <h2 style="font-size:var(--text-xl); font-weight:700; color:var(--gray-900); margin-bottom:var(--sp-1);">
        ${selectedWorker.name}
        ${selectedWorker.verified ? '<i class="fa-solid fa-circle-check" style="color:var(--color-primary); font-size:var(--text-lg);"></i>' : ''}
      </h2>
      <span class="badge badge-blue" style="background:${cat.bg}; color:${cat.color};">
        <i class="fa-solid ${cat.icon}"></i> ${selectedWorker.categoryLabel}
      </span>
      <div style="display:flex; justify-content:center; gap:var(--sp-6); margin-top:var(--sp-4);">
        <div style="text-align:center;">
          <div style="font-size:var(--text-xl); font-weight:800; color:var(--gray-900);">${selectedWorker.rating}</div>
          <div style="font-size:var(--text-xs); color:var(--gray-400);">★ Rating</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:var(--text-xl); font-weight:800; color:var(--gray-900);">${selectedWorker.reviews}</div>
          <div style="font-size:var(--text-xs); color:var(--gray-400);">Reseñas</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:var(--text-xl); font-weight:800; color:var(--gray-900);">${selectedWorker.completedJobs}</div>
          <div style="font-size:var(--text-xs); color:var(--gray-400);">Trabajos</div>
        </div>
      </div>
    </div>

    <div style="display:flex; flex-wrap:wrap; gap:var(--sp-2); margin-bottom:var(--sp-5);">
      <span class="badge badge-gray"><i class="fa-solid fa-location-dot" style="color:var(--color-primary);"></i> ${selectedWorker.city} · ${VOY.formatDistance(selectedWorker.distance)}</span>
      <span class="badge badge-gray"><i class="fa-solid fa-clock" style="color:var(--color-primary);"></i> Responde ${selectedWorker.responseTime}</span>
      <span class="badge ${selectedWorker.available ? 'badge-green' : 'badge-gray'}">${selectedWorker.available ? '● Disponible ahora' : '○ No disponible'}</span>
    </div>

    <div class="detail-section">
      <h4>Sobre mí</h4>
      <p style="font-size:var(--text-sm); color:var(--gray-600); line-height:1.7;">${selectedWorker.bio}</p>
    </div>

    <div class="detail-section">
      <h4>Especialidades</h4>
      <div class="skill-tags">
        ${selectedWorker.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
      </div>
    </div>

    <div class="detail-section">
      <h4>Tarifas</h4>
      <div style="background:var(--blue-50); border-radius:var(--radius-xl); padding:var(--sp-4);">
        <div style="font-size:var(--text-2xl); font-weight:800; color:var(--color-primary);">
          ${VOY.formatCLP(selectedWorker.priceMin)} – ${VOY.formatCLP(selectedWorker.priceMax)}
        </div>
        <div style="font-size:var(--text-sm); color:var(--gray-500);">por ${selectedWorker.priceUnit} · Precio final acordado con el profesional</div>
      </div>
    </div>

    ${selectedWorker.gallery.length > 0 ? `
    <div class="detail-section">
      <h4>Trabajos realizados</h4>
      <div class="gallery-row">
        ${selectedWorker.gallery.map(img => `<img src="${img}" alt="Trabajo" />`).join('')}
      </div>
    </div>` : ''}

    <div class="detail-section" id="reviewsSection">
      <h4>Reseñas recientes</h4>
      <div id="workerReviews"><i class="fa-solid fa-spinner fa-spin" style="color:var(--gray-300);"></i></div>
    </div>
  `;

  document.getElementById('workerDetail').classList.add('open');

  // Cargar reseñas reales desde Bookings
  loadWorkerReviewsInDetail(selectedWorker.id);

  const svc = document.getElementById('bookingService');
  if (svc) svc.innerHTML = selectedWorker.skills.map(s => `<option>${s}</option>`).join('');

  const info = document.getElementById('bookingWorkerInfo');
  if (info) {
    info.innerHTML = `
      <img src="${selectedWorker.avatar}" alt="${selectedWorker.name}" class="avatar avatar-md" />
      <div>
        <div style="font-weight:700; color:var(--gray-900);">${selectedWorker.name}</div>
        <div style="font-size:var(--text-sm); color:var(--gray-500);">${selectedWorker.categoryLabel} · ⭐ ${selectedWorker.rating}</div>
      </div>
      <div style="margin-left:auto; text-align:right;">
        <div style="font-weight:700; color:var(--color-primary);">Desde ${VOY.formatCLP(selectedWorker.priceMin)}</div>
        <div style="font-size:var(--text-xs); color:var(--gray-400);">/ ${selectedWorker.priceUnit}</div>
      </div>`;
  }
  updateBookingSummary();

  if (map) map.flyTo([selectedWorker.lat, selectedWorker.lng], 14, { duration: 0.8 });
}

async function loadWorkerReviewsInDetail(workerId) {
  const el = document.getElementById('workerReviews');
  if (!el) return;
  try {
    const bookings = await VoyDB.getBookings({ status: 'completed' });
    const reviews = bookings.filter(b => b.workerId === workerId && b.rating);
    if (!reviews.length) {
      el.innerHTML = '<p style="color:var(--gray-400);font-size:var(--text-sm);">Aún sin reseñas.</p>';
      return;
    }
    el.innerHTML = reviews.map(b => {
      const client = VOY_DATA.clients.find(c => c.id === b.clientId);
      return `
      <div class="review-item">
        <div class="review-header">
          <img src="${client?.avatar || 'https://i.pravatar.cc/32'}" class="avatar avatar-xs" />
          <div>
            <div style="font-size:var(--text-sm); font-weight:600; color:var(--gray-900);">${client?.name || 'Cliente'}</div>
            <div class="review-stars">${'★'.repeat(b.rating)}${'☆'.repeat(5 - b.rating)}</div>
          </div>
          <span style="margin-left:auto; font-size:var(--text-xs); color:var(--gray-400);">${b.date}</span>
        </div>
        ${b.review ? `<div class="review-text">"${b.review}"</div>` : ''}
      </div>`;
    }).join('');
  } catch {
    el.innerHTML = '<p style="color:var(--gray-400);font-size:var(--text-sm);">No se pudieron cargar reseñas.</p>';
  }
}

function closeWorkerDetail() {
  document.getElementById('workerDetail').classList.remove('open');
  selectedWorker = null;
}

function toggleFavorite() {
  if (!selectedWorker) return;
  favorites = VoyDB.toggleFavoriteLocal(selectedWorker.id);
  const isFav = favorites.has(selectedWorker.id);
  document.getElementById('btnFavorite').innerHTML = isFav
    ? '<i class="fa-solid fa-heart" style="color:#ef4444;"></i>'
    : '<i class="fa-regular fa-heart"></i>';
  VOY.showToast(isFav ? 'Guardado en favoritos ❤️' : 'Eliminado de favoritos', isFav ? 'success' : 'info');
  filterWorkers();
}

/* ── Booking ────────────────────────────── */
function quickBook(id) {
  openWorkerDetail(id);
  setTimeout(() => VOY.openModal('bookingModal'), 300);
}

function updateBookingSummary() {
  if (!selectedWorker) return;
  const el = document.getElementById('bookingPriceSummary');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2);">
      <span style="color:var(--gray-600);">Precio estimado</span>
      <strong>${VOY.formatCLP(selectedWorker.priceMin)} – ${VOY.formatCLP(selectedWorker.priceMax)}</strong>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2);">
      <span style="color:var(--gray-600);">Cargo de servicio VOY (15%)</span>
      <span style="color:var(--gray-500);">Incluido</span>
    </div>
    <div style="height:1px; background:var(--blue-200); margin: var(--sp-3) 0;"></div>
    <div style="display:flex; justify-content:space-between;">
      <strong style="color:var(--gray-900);">Total estimado</strong>
      <strong style="color:var(--color-primary); font-size:var(--text-lg);">${VOY.formatCLP(selectedWorker.priceMin)}</strong>
    </div>
    <div style="font-size:var(--text-xs); color:var(--gray-400); margin-top:var(--sp-2);">El precio final se acuerda con el profesional antes del inicio del servicio.</div>`;
}

async function confirmBooking() {
  if (!selectedWorker) return;
  const date    = document.getElementById('bookingDate')?.value || '';
  const time    = document.getElementById('bookingTime')?.value || '';
  const address = document.getElementById('bookingAddress')?.value || '';
  const service = document.getElementById('bookingService')?.value || selectedWorker.skills[0] || '';

  const btn = document.querySelector('#bookingModal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    await VoyDB.createBooking({
      clientId:   clientData?.id || clientSession?.id || 101,
      workerId:   selectedWorker.id,
      category:   selectedWorker.category,
      service,
      date,
      time,
      address,
      price:      selectedWorker.priceMin,
    });

    // Crear también la solicitud en la tabla Requests para el worker
    await VoyDB.createRequest({
      clientId:       clientData?.id || clientSession?.id || 101,
      clientName:     clientData?.name || clientSession?.name || 'Cliente',
      clientAvatar:   clientData?.avatar || clientSession?.avatar || '',
      clientRating:   5,
      service,
      date,
      time,
      address,
      estimatedPrice: selectedWorker.priceMin,
      distance:       selectedWorker.distance,
      workerRecordId: selectedWorker._recordId,
    });

    // Refrescar bookings
    VOY_DATA.bookings = await VoyDB.getBookings();

    VOY.closeModal('bookingModal');
    VOY.showToast(`¡Solicitud enviada a ${selectedWorker.name}!`, 'success');
    setTimeout(() => VOY.showToast('El profesional confirmará en breve.', 'info'), 1500);
    loadActiveServices();
    updateActiveBadge();
  } catch (e) {
    VOY.showToast('Error al crear la reserva. Intenta de nuevo.', 'error');
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmar reserva'; }
  }
}

/* ── Chat ───────────────────────────────── */
let chatConversationId = null;
let chatPollInterval   = null;

async function toggleChat() {
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  const showing = panel.classList.contains('open');
  if (showing) {
    panel.classList.remove('open');
    stopChatPolling();
  } else {
    if (!chatConversationId && selectedWorker) openChat();
    else {
      panel.classList.add('open');
      await renderChatMessages();
      startChatPolling();
    }
  }
}

function startChatPolling() {
  stopChatPolling();
  chatPollInterval = setInterval(renderChatMessages, 5000);
}

function stopChatPolling() {
  if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
}

async function renderChatMessages() {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  if (!chatConversationId) return;
  el.innerHTML = '<div style="text-align:center;padding:8px;color:var(--gray-300);font-size:12px;"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const msgs = await VoyDB.getMessages(chatConversationId);
    if (!msgs.length) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray-400);font-size:13px;">Inicia la conversación</div>';
      return;
    }
    el.innerHTML = msgs.map(m => `
      <div class="chat-msg ${m.from === 'client' ? 'sent' : 'received'}">
        <div class="chat-msg-bubble">${m.text}</div>
        <div class="chat-msg-time">${m.time}</div>
      </div>`).join('');
    el.scrollTop = el.scrollHeight;
  } catch {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--gray-400);">Error cargando mensajes</div>';
  }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';

  try {
    await VoyDB.sendMessage(chatConversationId, 'client', text);
    await renderChatMessages();
  } catch (e) {
    VOY.showToast('Error al enviar mensaje', 'error');
  }
}

function handleChatKey(e) {
  if (e.key === 'Enter') sendMessage();
}

function openChatWithWorker(workerId) {
  selectedWorker = VOY_DATA.workers.find(w => w.id === workerId);
  openChat();
}

function openChat() {
  if (!selectedWorker) return;
  const myId = clientData?.id || clientSession?.id || 101;
  chatConversationId = `chat_w${selectedWorker.id}_c${myId}`;
  const panel  = document.getElementById('chatPanel');
  const title  = document.getElementById('chatWorkerName');
  const avatar = document.getElementById('chatWorkerAvatar');
  if (title)  title.textContent = selectedWorker.name;
  if (avatar) avatar.src = selectedWorker.avatar;
  if (panel) {
    panel.classList.add('open');
    renderChatMessages();
    startChatPolling();
  }
}

/* ── Active badge ───────────────────────── */
function updateActiveBadge() {
  const myId = myClientId();
  const count = VOY_DATA.bookings.filter(b =>
    (b.status === 'active' || b.status === 'pending') && (!myId || b.clientId === myId)
  ).length;
  const badge = document.getElementById('activosBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  }
}

/* ── Helpers ─────────────────────────────── */
function myClientId() {
  return clientData?.id || clientSession?.id;
}

/* ── Active services ────────────────────── */
function loadActiveServices() {
  const el = document.getElementById('activeServices');
  if (!el) return;
  const myId = myClientId();
  const active = VOY_DATA.bookings.filter(b =>
    (b.status === 'active' || b.status === 'pending') && (!myId || b.clientId === myId)
  );
  if (!active.length) {
    el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-calendar-days"></i><h3>Sin servicios activos</h3><p>Cuando agendes un servicio aparecerá aquí.</p></div>';
    return;
  }
  el.innerHTML = active.map(b => {
    const worker = VOY_DATA.workers.find(w => w.id === b.workerId);
    const statusColors = { active: 'badge-green', pending: 'badge-yellow' };
    const statusLabels = { active: 'En curso', pending: 'Pendiente' };
    return `
    <div class="card" style="margin-bottom:var(--sp-4);">
      <div class="card-body">
        <div style="display:flex; align-items:center; gap:var(--sp-4);">
          <img src="${worker?.avatar || ''}" class="avatar avatar-lg" />
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-1);">
              <strong>${worker?.name || 'Profesional'}</strong>
              <span class="badge ${statusColors[b.status]}">${statusLabels[b.status]}</span>
            </div>
            <div style="font-size:var(--text-sm); color:var(--gray-600);">${b.service}</div>
            <div style="font-size:var(--text-xs); color:var(--gray-400); margin-top:var(--sp-1);">
              <i class="fa-solid fa-calendar" style="color:var(--color-primary);"></i> ${b.date} a las ${b.time} &nbsp;
              <i class="fa-solid fa-location-dot" style="color:var(--color-primary);"></i> ${b.address}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:var(--color-primary); font-size:var(--text-lg);">${VOY.formatCLP(b.price)}</div>
            <div style="font-size:var(--text-xs); color:var(--gray-400);">Ref: ${b.id}</div>
          </div>
        </div>
        <div style="display:flex; gap:var(--sp-3); margin-top:var(--sp-4);">
          <button class="btn btn-outline btn-sm" onclick="openChatWithWorker(${b.workerId})"><i class="fa-solid fa-comment-dots"></i> Mensaje</button>
          ${b.status === 'active' ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking('${b._recordId}')"><i class="fa-solid fa-xmark"></i> Cancelar</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function cancelBooking(recordId) {
  if (!confirm('¿Confirmas la cancelación?')) return;
  try {
    await VoyDB.updateBookingStatus(recordId, 'cancelled');
    VOY_DATA.bookings = await VoyDB.getBookings();
    loadActiveServices();
    updateActiveBadge();
    VOY.showToast('Reserva cancelada', 'info');
  } catch (e) {
    VOY.showToast('Error al cancelar', 'error');
  }
}

/* ── Historial ──────────────────────────── */
function loadHistorial() {
  const el = document.getElementById('historialTable');
  if (!el) return;
  const myId = myClientId();
  const completed = VOY_DATA.bookings.filter(b =>
    b.status === 'completed' && (!myId || b.clientId === myId)
  );
  el.innerHTML = `
    <thead>
      <tr>
        <th>Ref.</th><th>Servicio</th><th>Profesional</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Calificación</th><th></th>
      </tr>
    </thead>
    <tbody>
      ${completed.map(b => {
        const w = VOY_DATA.workers.find(x => x.id === b.workerId);
        return `<tr>
          <td><code style="font-size:var(--text-xs); background:var(--gray-100); padding:2px 6px; border-radius:4px;">${b.id}</code></td>
          <td>${b.service}</td>
          <td>
            <div style="display:flex; align-items:center; gap:var(--sp-2);">
              <img src="${w?.avatar || ''}" class="avatar avatar-xs" />
              ${w?.name || 'Profesional'}
            </div>
          </td>
          <td>${b.date}</td>
          <td style="font-weight:600; color:var(--color-primary);">${VOY.formatCLP(b.price)}</td>
          <td><span class="badge badge-green">Completado</span></td>
          <td>${b.rating ? '★'.repeat(b.rating) : '<span style="color:var(--gray-300);">Sin calificar</span>'}</td>
          <td>${!b.rating ? `<button class="btn btn-ghost btn-sm" onclick="openRatingModal('${b._recordId}')">⭐ Calificar</button>` : ''}</td>
        </tr>`;
      }).join('')}
    </tbody>`;
}

/* ── Rating modal ───────────────────────── */
let pendingRatingRecordId = null;
let selectedRating = 5;

function setRating(val) {
  selectedRating = val;
  document.querySelectorAll('#starRating span').forEach((s, i) => {
    s.style.color = i < val ? 'var(--color-warning)' : 'var(--gray-300)';
  });
}

function openRatingModal(recordId) {
  pendingRatingRecordId = recordId;
  selectedRating = 5;
  setRating(5);
  const textarea = document.getElementById('ratingComment');
  if (textarea) textarea.value = '';
  VOY.openModal('ratingModal');
}

async function submitRating() {
  if (!pendingRatingRecordId) return;
  const review = document.getElementById('ratingComment')?.value || '';
  const btn = document.querySelector('#ratingModal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  try {
    await VoyDB.addBookingReview(pendingRatingRecordId, selectedRating, review);
    VOY_DATA.bookings = await VoyDB.getBookings();
    VOY.closeModal('ratingModal');
    VOY.showToast('¡Gracias por tu calificación!', 'success');
    loadHistorial();
  } catch (e) {
    VOY.showToast('Error al guardar la calificación', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-star"></i> Enviar calificación'; }
  }
}

/* ── Client profile ─────────────────────── */
async function loadClientProfile() {
  const el = document.getElementById('clientProfile');
  if (!el) return;

  // Si clientData no se cargó, reintentar desde Airtable
  if (!clientData && clientSession?.email) {
    el.innerHTML = `<div style="text-align:center;padding:var(--sp-8);color:var(--gray-400);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;margin-bottom:var(--sp-3);color:var(--color-primary);"></i>
      <p>Cargando perfil...</p></div>`;
    try {
      clientData = await VoyDB.getClientByEmail(clientSession.email);
    } catch(e) { /* sigue */ }
  }

  const client = clientData;
  if (!client) {
    el.innerHTML = `<div style="text-align:center;padding:var(--sp-8);color:var(--gray-400);">
      <i class="fa-solid fa-circle-exclamation" style="font-size:2rem;margin-bottom:var(--sp-3);"></i>
      <p>No se pudo cargar tu perfil. <a href="#" onclick="location.reload()">Reintentar</a></p>
    </div>`;
    return;
  }

  const myId           = myClientId();
  const myBookings     = VOY_DATA.bookings.filter(b => !myId || b.clientId === myId);
  const favCount       = favorites.size;
  const completedCount = myBookings.filter(b => b.status === 'completed').length;
  const reviewCount    = myBookings.filter(b => b.rating).length;
  const memberSince    = client.memberSince
    ? new Date(client.memberSince).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    : 'Miembro VOY';

  el.innerHTML = `
    <div class="profile-grid" style="display:grid; grid-template-columns:280px 1fr; gap:var(--sp-6);">

      <!-- Columna izquierda -->
      <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
        <div class="card">
          <div class="card-body" style="text-align:center;padding:var(--sp-6);">
            <input type="file" id="clientAvatarInput" accept="image/*" style="display:none;" onchange="handleClientAvatarUpload(this)" />
            <div style="position:relative;display:inline-block;margin-bottom:var(--sp-4);">
              <img src="${client.avatar || 'https://i.pravatar.cc/96'}" class="avatar avatar-xl" id="clientAvatarImg" style="width:96px;height:96px;" />
              <button onclick="document.getElementById('clientAvatarInput').click()"
                style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:50%;background:var(--color-primary);color:white;border:2px solid white;cursor:pointer;font-size:11px;">
                <i class="fa-solid fa-camera"></i>
              </button>
            </div>
            <h2 style="font-size:var(--text-xl);font-weight:700;margin-bottom:var(--sp-1);">${client.name}</h2>
            <p style="font-size:var(--text-xs);color:var(--gray-400);margin-bottom:var(--sp-1);">
              <i class="fa-solid fa-location-dot" style="color:var(--color-primary);"></i> ${client.city}
            </p>
            <p style="font-size:var(--text-xs);color:var(--gray-400);margin-bottom:var(--sp-4);">
              <i class="fa-solid fa-calendar" style="color:var(--color-primary);"></i> Desde ${memberSince}
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-2);background:var(--gray-50);border-radius:var(--radius-xl);padding:var(--sp-3);">
              <div>
                <div style="font-size:var(--text-xl);font-weight:800;color:var(--gray-900);">${completedCount}</div>
                <div style="font-size:10px;color:var(--gray-400);">Servicios</div>
              </div>
              <div>
                <div style="font-size:var(--text-xl);font-weight:800;color:var(--gray-900);">${reviewCount}</div>
                <div style="font-size:10px;color:var(--gray-400);">Reseñas</div>
              </div>
              <div>
                <div style="font-size:var(--text-xl);font-weight:800;color:var(--gray-900);">${favCount}</div>
                <div style="font-size:10px;color:var(--gray-400);">Favoritos</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-body" style="padding:var(--sp-3);">
            <button class="btn btn-ghost" style="width:100%;justify-content:flex-start;color:var(--color-danger);" onclick="logout()">
              <i class="fa-solid fa-right-from-bracket"></i> Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      <!-- Columna derecha con tabs -->
      <div class="card">
        <div style="display:flex;border-bottom:1px solid var(--gray-100);padding:0 var(--sp-5);">
          <button id="tabInfoBtn" onclick="switchProfileTab('info')"
            style="padding:var(--sp-4) var(--sp-4);font-size:var(--text-sm);font-weight:600;border:none;background:none;cursor:pointer;color:var(--color-primary);border-bottom:2px solid var(--color-primary);margin-bottom:-1px;">
            <i class="fa-solid fa-user"></i> Información
          </button>
          <button id="tabSecBtn" onclick="switchProfileTab('seguridad')"
            style="padding:var(--sp-4) var(--sp-4);font-size:var(--text-sm);font-weight:600;border:none;background:none;cursor:pointer;color:var(--gray-400);border-bottom:2px solid transparent;margin-bottom:-1px;">
            <i class="fa-solid fa-lock"></i> Seguridad
          </button>
        </div>

        <!-- Tab Información -->
        <div id="tabInfo" class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">
            <div class="input-group">
              <label class="input-label">Nombre completo</label>
              <input class="input" id="cName" value="${client.name}" />
            </div>
            <div class="input-group">
              <label class="input-label">Teléfono</label>
              <input class="input" id="cPhone" value="${client.phone || ''}" placeholder="+56 9 xxxx xxxx" />
            </div>
            <div class="input-group">
              <label class="input-label">Email</label>
              <input class="input" id="cEmail" value="${client.email || ''}" type="email" />
            </div>
            <div class="input-group">
              <label class="input-label">Ciudad</label>
              <input class="input" id="cCity" value="${client.city}" />
            </div>
          </div>
          <button class="btn btn-primary" style="margin-top:var(--sp-5);" onclick="saveClientProfile('${client._recordId}')">
            <i class="fa-solid fa-check"></i> Guardar cambios
          </button>
        </div>

        <!-- Tab Seguridad -->
        <div id="tabSeguridad" class="card-body" style="display:none;">
          <div style="max-width:420px;display:flex;flex-direction:column;gap:var(--sp-4);">
            <div style="padding:var(--sp-4);background:var(--blue-50);border-radius:var(--radius-xl);font-size:var(--text-sm);color:var(--gray-600);">
              <i class="fa-solid fa-circle-info" style="color:var(--color-primary);"></i>
              Debes ingresar tu contraseña actual para confirmar el cambio.
            </div>
            <div class="input-group">
              <label class="input-label">Contraseña actual</label>
              <input class="input" id="cOldPwd" type="password" placeholder="Tu contraseña actual" />
            </div>
            <div class="input-group">
              <label class="input-label">Nueva contraseña</label>
              <input class="input" id="cNewPwd" type="password" placeholder="Mínimo 6 caracteres" />
            </div>
            <div class="input-group">
              <label class="input-label">Confirmar nueva contraseña</label>
              <input class="input" id="cNewPwd2" type="password" placeholder="Repite la nueva contraseña" />
            </div>
            <button class="btn btn-primary" id="btnChangePwd" onclick="changeClientPassword('${client._recordId}', '${client.passwordHash || ''}')">
              <i class="fa-solid fa-key"></i> Cambiar contraseña
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function switchProfileTab(tab) {
  const isInfo = tab === 'info';
  document.getElementById('tabInfo').style.display      = isInfo ? '' : 'none';
  document.getElementById('tabSeguridad').style.display = isInfo ? 'none' : '';
  document.getElementById('tabInfoBtn').style.color        = isInfo ? 'var(--color-primary)' : 'var(--gray-400)';
  document.getElementById('tabInfoBtn').style.borderBottom = isInfo ? '2px solid var(--color-primary)' : '2px solid transparent';
  document.getElementById('tabSecBtn').style.color         = isInfo ? 'var(--gray-400)' : 'var(--color-primary)';
  document.getElementById('tabSecBtn').style.borderBottom  = isInfo ? '2px solid transparent' : '2px solid var(--color-primary)';
}

async function saveClientProfile(recordId) {
  const btn = document.querySelector('#tabInfo .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    const updated = await VoyDB.saveClientProfile(recordId, {
      name:  document.getElementById('cName')?.value,
      phone: document.getElementById('cPhone')?.value,
      email: document.getElementById('cEmail')?.value,
      city:  document.getElementById('cCity')?.value,
    });
    if (clientData) { clientData.name = updated.name; clientData.phone = updated.phone; clientData.city = updated.city; }
    const session = VoyAuth.getSession();
    if (session) { session.name = updated.name; VoyAuth.saveSession(session); }
    VoyAuth.applySessionToUI(VoyAuth.getSession());
    VOY.showToast('Perfil actualizado correctamente', 'success');
  } catch (e) {
    VOY.showToast('Error al guardar perfil', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar cambios'; }
  }
}

async function changeClientPassword(recordId, currentHash) {
  const oldPwd  = document.getElementById('cOldPwd')?.value;
  const newPwd  = document.getElementById('cNewPwd')?.value;
  const newPwd2 = document.getElementById('cNewPwd2')?.value;

  if (!oldPwd || !newPwd || !newPwd2) { VOY.showToast('Completa todos los campos', 'error'); return; }
  if (newPwd.length < 6)              { VOY.showToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
  if (newPwd !== newPwd2)             { VOY.showToast('Las contraseñas no coinciden', 'error'); return; }

  const btn = document.getElementById('btnChangePwd');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }

  try {
    const oldHash = await VoyAuth.hashPassword(oldPwd);
    if (oldHash !== currentHash) { VOY.showToast('Contraseña actual incorrecta', 'error'); return; }

    const newHash = await VoyAuth.hashPassword(newPwd);
    await VoyDB.saveClientProfile(recordId, { passwordHash: newHash });
    if (clientData) clientData.passwordHash = newHash;

    document.getElementById('cOldPwd').value  = '';
    document.getElementById('cNewPwd').value  = '';
    document.getElementById('cNewPwd2').value = '';
    VOY.showToast('Contraseña cambiada correctamente', 'success');
  } catch (e) {
    VOY.showToast('Error al cambiar contraseña', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-key"></i> Cambiar contraseña'; }
  }
}

/* ── Pagos ──────────────────────────────── */
async function loadPagos() {
  const el = document.getElementById('pagosView');
  if (!el) return;
  const myId = myClientId();
  const txs = VOY_DATA.bookings.filter(b =>
    b.status === 'completed' && (!myId || b.clientId === myId)
  );

  el.innerHTML = `
    <div style="display:grid; grid-template-columns: 360px 1fr; gap:var(--sp-6);">
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <strong>Métodos guardados</strong>
          <button class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Agregar</button>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--sp-3);">
          <div style="display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-4);border:1.5px solid var(--color-primary);border-radius:var(--radius-xl);background:var(--blue-50);">
            <i class="fa-brands fa-cc-visa" style="font-size:2rem;color:#1a1f71;"></i>
            <div style="flex:1;"><div style="font-weight:600;">Visa •••• 4321</div><div style="font-size:var(--text-xs);color:var(--gray-400);">Vence 09/27</div></div>
            <span class="badge badge-blue">Principal</span>
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-4);border:1.5px solid var(--gray-200);border-radius:var(--radius-xl);">
            <i class="fa-brands fa-cc-mastercard" style="font-size:2rem;color:#eb001b;"></i>
            <div style="flex:1;"><div style="font-weight:600;">Mastercard •••• 8890</div><div style="font-size:var(--text-xs);color:var(--gray-400);">Vence 03/26</div></div>
          </div>
          <div style="padding:var(--sp-4);border:1.5px dashed var(--gray-300);border-radius:var(--radius-xl);text-align:center;cursor:pointer;color:var(--gray-400);" onclick="VOY.showToast('Próximamente: Webpay + Transferencia','info')">
            <i class="fa-solid fa-plus"></i> Agregar Webpay / Transferencia
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><strong>Últimas transacciones</strong></div>
        <div class="card-body" style="padding:0;">
          <table class="data-table">
            <thead><tr><th>Fecha</th><th>Servicio</th><th>Monto</th><th>Estado</th></tr></thead>
            <tbody>
              ${txs.map(b => `
              <tr>
                <td>${b.date}</td>
                <td>${b.service}</td>
                <td style="color:var(--color-danger);">-${VOY.formatCLP(b.price)}</td>
                <td><span class="badge badge-green">Pagado</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

/* ── Favorites ──────────────────────────── */
function loadFavorites() {
  const el = document.getElementById('favoritosGrid');
  if (!el) return;
  const favWorkers = VOY_DATA.workers.filter(w => favorites.has(w.id));
  if (!favWorkers.length) {
    el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-heart"></i><h3>Sin favoritos</h3><p>Guarda profesionales que te gusten para encontrarlos fácil.</p></div>';
    return;
  }
  el.innerHTML = favWorkers.map(w => {
    const cat = VOY.getCategoryById(w.category);
    return `
    <div class="provider-card" onclick="openWorkerDetail(${w.id})">
      <img src="${w.avatar}" class="avatar avatar-md" />
      <div class="provider-card-body">
        <div class="provider-card-name">${w.name} <i class="fa-solid fa-heart" style="color:#ef4444;"></i></div>
        <span class="badge badge-blue" style="background:${cat.bg};color:${cat.color};">${w.categoryLabel}</span>
        <div class="provider-card-meta" style="margin-top:var(--sp-2);">
          <span>⭐ ${w.rating}</span>
          <span>📍 ${VOY.formatDistance(w.distance)}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── Notifications ──────────────────────── */
async function loadNotifications() {
  const el = document.getElementById('notifList');
  if (!el) return;

  const activeBookings  = VOY_DATA.bookings.filter(b => b.status === 'active');
  const pendingRatings  = VOY_DATA.bookings.filter(b => b.status === 'completed' && !b.rating);
  const notifs = [];

  activeBookings.forEach(b => {
    const w = VOY_DATA.workers.find(x => x.id === b.workerId);
    notifs.push({ icon: '✅', bg: '#d1fae5', text: `<strong>${w?.name || 'Profesional'}</strong> confirmó tu reserva para el ${b.date}.`, time: 'Reciente', unread: true });
  });
  pendingRatings.forEach(b => {
    notifs.push({ icon: '⭐', bg: '#fef3c7', text: `Califica tu servicio de <strong>${b.category}</strong> del ${b.date}.`, time: 'Pendiente', unread: true });
  });

  if (!notifs.length) {
    notifs.push({ icon: '💡', bg: '#dbeafe', text: 'No tienes notificaciones pendientes.', time: 'Ahora', unread: false });
  }

  const html = notifs.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}">
      <div class="notif-icon" style="background:${n.bg};">${n.icon}</div>
      <div class="notif-body">
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');

  if (el) el.innerHTML = html;
  const elView = document.getElementById('notifListView');
  if (elView) elView.innerHTML = html;
}

function openNotifications() { VOY.openModal('notifModal'); }

function loadNotificationsView() {
  loadNotifications();
}

/* ── View switcher ──────────────────────── */
function showView(name, el) {
  document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.remove('hidden');
  const activeLink = el || document.querySelector(`.sidebar-link[onclick*="'${name}'"]`);
  if (activeLink) activeLink.classList.add('active');

  if (name === 'favoritos') loadFavorites();
  if (name === 'historial') loadHistorial();
  if (name === 'pagos')     loadPagos();
  if (name === 'perfil')    loadClientProfile();
  if (name === 'notifs')    loadNotificationsView();
  if (name === 'activos')   loadActiveServices();
}

/* ── Close modals on overlay click ─────── */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) VOY.closeModal(overlay.id);
  });
});
