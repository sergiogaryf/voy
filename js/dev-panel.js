/* ============================================
   VOY — Panel de Desarrollador
   Solo visible en entornos de preview/dev
   ============================================ */

const VOY_DEV = (() => {
  // Versiones del proyecto (changelog manual)
  const versions = [
    {
      version: 'v1.0.0',
      date: '2026-03-12',
      author: 'Sergio',
      branch: 'main',
      status: 'production',
      changes: [
        'Landing page',
        'App cliente (búsqueda, mapa, agendar, chat, historial)',
        'App profesional (solicitudes, agenda, ganancias, verificación)',
        'Panel admin (métricas, verificaciones, usuarios)',
        'Conexión con Airtable',
      ],
    },
    {
      version: 'v1.1.0',
      date: '2026-03-12',
      author: 'Guillermo',
      branch: 'guillermo/dev-panel',
      status: 'preview',
      changes: [
        'Autocompletado en buscador del cliente',
        'Autocompletado en buscador del admin',
        'Panel de desarrollador con control de versiones',
      ],
    },
  ];

  const currentVersion = versions[versions.length - 1];

  // Detectar entorno
  function getEnv() {
    const host = window.location.hostname;
    if (host.includes('localhost') || host.includes('127.0.0.1')) return 'local';
    if (host.includes('git-') || host.includes('-git-')) return 'preview';
    return 'production';
  }

  // Detectar página actual
  function getPage() {
    const path = window.location.pathname;
    if (path.includes('/client')) return 'Cliente';
    if (path.includes('/worker')) return 'Profesional';
    if (path.includes('/admin'))  return 'Admin';
    if (path.includes('/login'))  return 'Login';
    return 'Landing';
  }

  function init() {
    createToggleButton();
    createPanel();
  }

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'devToggleBtn';
    btn.innerHTML = '<i class="fa-solid fa-code"></i>';
    btn.title = 'Panel de Desarrollador';
    btn.style.cssText = `
      position:fixed; bottom:20px; right:20px; z-index:10000;
      width:48px; height:48px; border-radius:50%; border:none;
      background:linear-gradient(135deg, #8B5CF6, #6D28D9); color:white;
      font-size:1.2rem; cursor:pointer; box-shadow:0 4px 16px rgba(109,40,217,0.4);
      transition:all 0.3s ease; display:flex; align-items:center; justify-content:center;
    `;
    btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    btn.onclick = togglePanel;
    document.body.appendChild(btn);
  }

  function createPanel() {
    const env = getEnv();
    const envColors = { local: '#F59E0B', preview: '#8B5CF6', production: '#10B981' };
    const envLabels = { local: 'Local', preview: 'Preview', production: 'Producción' };

    const panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.style.cssText = `
      position:fixed; bottom:80px; right:20px; z-index:9999;
      width:380px; max-height:80vh; background:#1a1a2e; color:#e0e0e0;
      border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.5);
      font-family:'Inter',sans-serif; font-size:13px; overflow:hidden;
      transform:translateY(20px); opacity:0; pointer-events:none;
      transition:all 0.3s ease;
    `;

    panel.innerHTML = `
      <div style="padding:16px 20px; background:linear-gradient(135deg, #8B5CF6, #6D28D9); display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <i class="fa-solid fa-terminal" style="font-size:1.1rem;"></i>
          <span style="font-weight:700; font-size:14px; color:white;">VOY Dev Panel</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:${envColors[env]}; color:white; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:600;">
            ${envLabels[env]}
          </span>
          <button onclick="VOY_DEV.close()" style="background:none; border:none; color:white; cursor:pointer; font-size:1.1rem; opacity:0.7;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Info actual -->
      <div style="padding:16px 20px; border-bottom:1px solid #2a2a4a;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div style="background:#2a2a4a; padding:10px 14px; border-radius:10px;">
            <div style="font-size:10px; color:#8B5CF6; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Versión</div>
            <div style="font-weight:700; font-size:15px; color:white;">${currentVersion.version}</div>
          </div>
          <div style="background:#2a2a4a; padding:10px 14px; border-radius:10px;">
            <div style="font-size:10px; color:#8B5CF6; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Página</div>
            <div style="font-weight:700; font-size:15px; color:white;">${getPage()}</div>
          </div>
          <div style="background:#2a2a4a; padding:10px 14px; border-radius:10px;">
            <div style="font-size:10px; color:#8B5CF6; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Autor</div>
            <div style="font-weight:700; font-size:15px; color:white;">${currentVersion.author}</div>
          </div>
          <div style="background:#2a2a4a; padding:10px 14px; border-radius:10px;">
            <div style="font-size:10px; color:#8B5CF6; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Fecha</div>
            <div style="font-weight:700; font-size:15px; color:white;">${currentVersion.date}</div>
          </div>
        </div>
      </div>

      <!-- Selector de versiones -->
      <div style="padding:16px 20px; border-bottom:1px solid #2a2a4a;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <span style="font-weight:600; color:white; font-size:13px;">
            <i class="fa-solid fa-code-branch" style="color:#8B5CF6; margin-right:6px;"></i>Historial de versiones
          </span>
        </div>
        <div id="devVersionList" style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto;">
        </div>
      </div>

      <!-- Acciones rápidas -->
      <div style="padding:16px 20px; border-bottom:1px solid #2a2a4a;">
        <div style="font-weight:600; color:white; font-size:13px; margin-bottom:12px;">
          <i class="fa-solid fa-bolt" style="color:#F59E0B; margin-right:6px;"></i>Acciones rápidas
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button onclick="VOY_DEV.goTo('/client')" class="dev-action-btn">
            <i class="fa-solid fa-user"></i> Cliente
          </button>
          <button onclick="VOY_DEV.goTo('/worker')" class="dev-action-btn">
            <i class="fa-solid fa-hard-hat"></i> Profesional
          </button>
          <button onclick="VOY_DEV.goTo('/admin')" class="dev-action-btn">
            <i class="fa-solid fa-shield-halved"></i> Admin
          </button>
          <button onclick="VOY_DEV.goTo('/')" class="dev-action-btn">
            <i class="fa-solid fa-house"></i> Landing
          </button>
          <button onclick="VOY_DEV.clearCache()" class="dev-action-btn" style="grid-column:span 2;">
            <i class="fa-solid fa-trash-can"></i> Limpiar caché y recargar
          </button>
        </div>
      </div>

      <!-- Datos del entorno -->
      <div style="padding:16px 20px;">
        <div style="font-weight:600; color:white; font-size:13px; margin-bottom:12px;">
          <i class="fa-solid fa-database" style="color:#10B981; margin-right:6px;"></i>Estado de datos
        </div>
        <div id="devDataStats" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;"></div>
      </div>
    `;

    // Inyectar estilos del panel
    const style = document.createElement('style');
    style.textContent = `
      .dev-action-btn {
        background:#2a2a4a; border:1px solid #3a3a5a; color:#e0e0e0; padding:8px 12px;
        border-radius:8px; font-size:12px; cursor:pointer; transition:all 0.2s;
        display:flex; align-items:center; justify-content:center; gap:6px; font-family:inherit;
      }
      .dev-action-btn:hover { background:#3a3a5a; border-color:#8B5CF6; color:white; }
      .dev-version-card {
        background:#2a2a4a; border:1px solid #3a3a5a; border-radius:10px; padding:10px 14px;
        cursor:pointer; transition:all 0.2s;
      }
      .dev-version-card:hover { border-color:#8B5CF6; }
      .dev-version-card.active { border-color:#8B5CF6; background:#2a2a5e; }
      .dev-stat-card {
        background:#2a2a4a; padding:8px 10px; border-radius:8px; text-align:center;
      }
      .dev-stat-card .stat-val { font-weight:700; font-size:16px; color:white; }
      .dev-stat-card .stat-label { font-size:9px; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-top:2px; }
      #devPanel::-webkit-scrollbar { width:4px; }
      #devPanel::-webkit-scrollbar-thumb { background:#3a3a5a; border-radius:4px; }
      #devVersionList::-webkit-scrollbar { width:3px; }
      #devVersionList::-webkit-scrollbar-thumb { background:#3a3a5a; border-radius:3px; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);

    renderVersionList();
    renderDataStats();
  }

  function renderVersionList() {
    const el = document.getElementById('devVersionList');
    if (!el) return;

    el.innerHTML = versions.slice().reverse().map((v, i) => {
      const isActive = v.version === currentVersion.version;
      const statusColors = { production: '#10B981', preview: '#8B5CF6', development: '#F59E0B' };
      const statusLabel = { production: 'Producción', preview: 'Preview', development: 'Desarrollo' };
      return `
        <div class="dev-version-card ${isActive ? 'active' : ''}" onclick="VOY_DEV.selectVersion('${v.version}')">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <span style="font-weight:700; color:white; font-size:13px;">${v.version}</span>
            <span style="background:${statusColors[v.status] || '#888'}; color:white; padding:1px 8px; border-radius:12px; font-size:10px; font-weight:600;">
              ${statusLabel[v.status] || v.status}
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:12px; font-size:11px; color:#888; margin-bottom:8px;">
            <span><i class="fa-solid fa-user" style="margin-right:4px;"></i>${v.author}</span>
            <span><i class="fa-solid fa-calendar" style="margin-right:4px;"></i>${v.date}</span>
            <span><i class="fa-solid fa-code-branch" style="margin-right:4px;"></i>${v.branch}</span>
          </div>
          <div style="font-size:11px; color:#aaa;">
            ${v.changes.map(c => `<div style="padding:2px 0;"><span style="color:#8B5CF6; margin-right:4px;">+</span>${c}</div>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderDataStats() {
    const el = document.getElementById('devDataStats');
    if (!el) return;

    // Esperar a que VOY_DATA esté listo
    const check = () => {
      if (typeof VOY_DATA !== 'undefined' && VOY_DATA.workers.length > 0) {
        el.innerHTML = `
          <div class="dev-stat-card">
            <div class="stat-val">${VOY_DATA.workers.length}</div>
            <div class="stat-label">Workers</div>
          </div>
          <div class="dev-stat-card">
            <div class="stat-val">${VOY_DATA.clients.length}</div>
            <div class="stat-label">Clientes</div>
          </div>
          <div class="dev-stat-card">
            <div class="stat-val">${VOY_DATA.bookings.length}</div>
            <div class="stat-label">Bookings</div>
          </div>`;
      } else {
        el.innerHTML = `
          <div class="dev-stat-card" style="grid-column:span 3;">
            <div style="color:#888; font-size:11px;">Esperando datos...</div>
          </div>`;
        setTimeout(check, 1000);
      }
    };
    check();
  }

  function togglePanel() {
    const panel = document.getElementById('devPanel');
    if (!panel) return;
    const isOpen = panel.style.opacity === '1';
    panel.style.opacity = isOpen ? '0' : '1';
    panel.style.pointerEvents = isOpen ? 'none' : 'auto';
    panel.style.transform = isOpen ? 'translateY(20px)' : 'translateY(0)';
  }

  function close() { togglePanel(); }

  function goTo(path) { window.location.href = path; }

  function clearCache() {
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
  }

  function selectVersion(ver) {
    const v = versions.find(x => x.version === ver);
    if (!v) return;
    // Mostrar detalle de la versión seleccionada
    const el = document.getElementById('devVersionList');
    el.querySelectorAll('.dev-version-card').forEach(card => card.classList.remove('active'));
    event.currentTarget.classList.add('active');
  }

  // Auto-init cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { togglePanel, close, goTo, clearCache, selectVersion, versions, getEnv };
})();
