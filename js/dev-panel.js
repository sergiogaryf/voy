/* ============================================
   VOY — Panel de Desarrollador v3
   Historial real desde GitHub + deploys + merge
   ============================================ */

const VOY_DEV = (() => {
  const REPO = 'sergiogaryf/voy';
  const DEPLOYS = {
    sergio:    { url: 'voy-app1.vercel.app',  label: 'Sergio',    color: '#0EA5E9', initials: 'SG' },
    guillermo: { url: 'voy-app-2.vercel.app', label: 'Guillermo', color: '#10B981', initials: 'GG' },
    fusion:    { url: 'voy-app-3.vercel.app', label: 'Fusión',    color: '#8B5CF6', initials: 'F3' },
  };

  let commitsCache = [];
  let mergeTimer = null;

  function getEnv() {
    if (typeof VOY_BUILD !== 'undefined' && VOY_BUILD.env !== 'local') return VOY_BUILD.env;
    const host = window.location.hostname;
    if (host.includes('localhost') || host.includes('127.0.0.1')) return 'local';
    if (host.includes('git-') || host.includes('-git-')) return 'preview';
    return 'production';
  }

  function getPage() {
    const path = window.location.pathname;
    if (path.includes('/client')) return 'Cliente';
    if (path.includes('/worker')) return 'Profesional';
    if (path.includes('/admin'))  return 'Admin';
    if (path.includes('/login'))  return 'Login';
    return 'Landing';
  }

  function getAuthorColor(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('sergio')) return '#0EA5E9';
    if (n.includes('guillermo') || n.includes('gglpro')) return '#10B981';
    if (n.includes('claude')) return '#8B5CF6';
    return '#F59E0B';
  }

  function getAuthorInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function init() {
    injectStyles();
    createToggleButton();
    createPanel();
    loadGitHubData();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #devPanel { position:fixed; bottom:80px; right:20px; z-index:9999; width:420px; max-height:85vh;
        background:#0f0f1a; color:#e0e0e0; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.6);
        font-family:'Inter',sans-serif; font-size:13px; overflow:hidden;
        transform:translateY(100%); opacity:0; pointer-events:none;
        transition:transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease; }
      #devPanel.open { transform:translateY(0); opacity:1; pointer-events:auto; }
      #devToggleBtn { position:fixed; bottom:20px; right:20px; z-index:10000; width:50px; height:50px;
        border-radius:50%; border:none; background:linear-gradient(135deg,#8B5CF6,#6D28D9); color:white;
        font-size:1.2rem; cursor:pointer; box-shadow:0 4px 20px rgba(109,40,217,0.5);
        transition:all 0.3s ease; display:flex; align-items:center; justify-content:center; }
      #devToggleBtn:hover { transform:scale(1.1) rotate(10deg); }
      .dev-header { padding:14px 20px; background:linear-gradient(135deg,#1a1a3e,#2a1a4e);
        display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #2a2a4a; }
      .dev-tabs { display:flex; background:#1a1a2e; border-bottom:1px solid #2a2a4a; padding:0 8px; }
      .dev-tab { padding:10px 14px; font-size:11px; font-weight:600; color:#555; cursor:pointer;
        border-bottom:2px solid transparent; transition:all 0.2s; white-space:nowrap; }
      .dev-tab:hover { color:#aaa; }
      .dev-tab.active { color:#8B5CF6; border-bottom-color:#8B5CF6; }
      .dev-tab-content { display:none; overflow-y:auto; max-height:calc(85vh - 130px); }
      .dev-tab-content.active { display:block; }

      .dev-commit { padding:12px 16px; border-bottom:1px solid #1a1a2e; cursor:pointer; transition:background 0.15s; }
      .dev-commit:hover { background:#1a1a30; }
      .dev-commit-header { display:flex; align-items:center; gap:10px; }
      .dev-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center;
        justify-content:center; font-size:10px; font-weight:700; color:white; flex-shrink:0; }
      .dev-commit-msg { font-size:13px; font-weight:600; color:#e0e0e0; line-height:1.3; flex:1;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dev-commit-meta { display:flex; align-items:center; gap:12px; font-size:11px; color:#555; margin-left:38px; margin-top:4px; }
      .dev-commit-meta i { width:12px; }
      .dev-commit-detail { margin:0 16px 12px 38px; background:#1a1a30; border:1px solid #2a2a4a;
        border-radius:10px; overflow:hidden; animation:slideDown 0.2s ease; }
      .dev-commit-detail-body { padding:12px; font-size:12px; }
      .dev-file-item { display:flex; align-items:center; gap:8px; padding:4px 0; color:#aaa; font-size:11px; font-family:monospace; }
      .dev-file-add { color:#34d399; }
      .dev-file-mod { color:#FBBF24; }
      .dev-file-del { color:#EF4444; }
      .dev-commit-stats { display:flex; gap:12px; padding:8px 12px; background:#0f0f1a; border-top:1px solid #2a2a4a; font-size:11px; }
      @keyframes slideDown { from { opacity:0; max-height:0; } to { opacity:1; max-height:400px; } }

      .dev-branch-tag { background:#2a2a4a; color:#8B5CF6; padding:2px 10px; border-radius:10px; font-size:10px; font-weight:600; }
      .dev-deploy-card { margin:8px 12px; padding:14px; background:#1a1a30; border-radius:12px; border:1px solid #2a2a4a; }
      .dev-deploy-url { font-size:12px; color:#8B5CF6; text-decoration:none; word-break:break-all; }
      .dev-deploy-url:hover { text-decoration:underline; }
      .dev-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:12px 16px; }
      .dev-info-card { background:#1a1a30; padding:10px 14px; border-radius:10px; border:1px solid #2a2a4a; }
      .dev-info-label { font-size:10px; color:#8B5CF6; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:3px; }
      .dev-info-val { font-weight:700; font-size:14px; color:white; }
      .dev-action-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:12px 16px; }
      .dev-action-btn { background:#1a1a30; border:1px solid #2a2a4a; color:#e0e0e0; padding:10px;
        border-radius:10px; font-size:12px; cursor:pointer; transition:all 0.2s;
        display:flex; align-items:center; justify-content:center; gap:6px; font-family:inherit; }
      .dev-action-btn:hover { background:#2a2a4a; border-color:#8B5CF6; color:white; }
      .dev-action-btn.active { background:#8B5CF620; border-color:#8B5CF6; color:#8B5CF6; }
      .dev-stat-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; padding:12px 16px; }
      .dev-stat-card { background:#1a1a30; padding:8px; border-radius:8px; text-align:center; border:1px solid #2a2a4a; }
      .dev-stat-val { font-weight:700; font-size:18px; color:white; }
      .dev-stat-label { font-size:9px; color:#555; text-transform:uppercase; margin-top:2px; }
      .dev-section-title { padding:12px 16px 4px; font-size:11px; font-weight:700; color:#444;
        text-transform:uppercase; letter-spacing:0.08em; }
      .dev-pr { padding:12px 16px; border-bottom:1px solid #1a1a2e; display:flex; align-items:center; gap:10px; cursor:pointer; }
      .dev-pr:hover { background:#1a1a30; }
      .dev-pr-icon { width:28px; height:28px; border-radius:50%; display:flex; align-items:center;
        justify-content:center; font-size:12px; flex-shrink:0; }
      .dev-pr-open { background:#1a3a1a; color:#10B981; }
      .dev-pr-merged { background:#2a1a4a; color:#8B5CF6; }
      .dev-pr-closed { background:#3a1a1a; color:#EF4444; }
      .dev-loading { text-align:center; padding:24px; color:#555; }
      .dev-loading i { animation:spin 1s linear infinite; }
      .dev-merge-btn { background:linear-gradient(135deg,#8B5CF6,#6D28D9); border:none; color:white; padding:10px 16px;
        border-radius:10px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.2s;
        display:flex; align-items:center; justify-content:center; gap:6px; font-family:inherit; width:100%; }
      .dev-merge-btn:hover { opacity:0.9; transform:scale(1.01); }
      .dev-merge-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
      .dev-auto-badge { display:inline-flex; align-items:center; gap:4px; font-size:10px; padding:2px 8px;
        border-radius:10px; font-weight:600; }
      .dev-auto-on { background:#10B98120; color:#10B981; }
      .dev-auto-off { background:#EF444420; color:#EF4444; }
      @keyframes spin { to { transform:rotate(360deg); } }
      #devPanel::-webkit-scrollbar, .dev-tab-content::-webkit-scrollbar { width:4px; }
      #devPanel::-webkit-scrollbar-thumb, .dev-tab-content::-webkit-scrollbar-thumb { background:#2a2a4a; border-radius:4px; }
    `;
    document.head.appendChild(style);
  }

  function createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'devToggleBtn';
    btn.innerHTML = '<i class="fa-solid fa-code"></i>';
    btn.title = 'Panel de Desarrollador';
    btn.onclick = togglePanel;
    document.body.appendChild(btn);
  }

  function createPanel() {
    const env = getEnv();
    const envColors = { local:'#F59E0B', preview:'#8B5CF6', production:'#10B981' };
    const envLabels = { local:'Local', preview:'Preview', production:'Producción' };
    const build = typeof VOY_BUILD !== 'undefined' ? VOY_BUILD : {};

    const panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.innerHTML = `
      <div class="dev-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <i class="fa-solid fa-terminal" style="font-size:1.1rem;color:#8B5CF6;"></i>
          <span style="font-weight:700;font-size:14px;color:white;">VOY Dev Panel</span>
          <span style="font-size:10px;color:#555;">v3</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="background:${envColors[env]||'#888'};color:white;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:600;">
            ${envLabels[env]||env}
          </span>
          <button onclick="VOY_DEV.close()" style="background:none;border:none;color:#666;cursor:pointer;font-size:1rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div class="dev-tabs">
        <div class="dev-tab active" onclick="VOY_DEV.switchTab('commits')">
          <i class="fa-solid fa-code-commit"></i> Commits
        </div>
        <div class="dev-tab" onclick="VOY_DEV.switchTab('prs')">
          <i class="fa-solid fa-code-pull-request"></i> PRs
        </div>
        <div class="dev-tab" onclick="VOY_DEV.switchTab('deploys')">
          <i class="fa-solid fa-rocket"></i> Deploys
        </div>
        <div class="dev-tab" onclick="VOY_DEV.switchTab('tools')">
          <i class="fa-solid fa-wrench"></i> Tools
        </div>
      </div>

      <!-- Tab: Commits -->
      <div class="dev-tab-content active" id="devTab-commits">
        <div class="dev-info-grid">
          <div class="dev-info-card">
            <div class="dev-info-label">Commit</div>
            <div class="dev-info-val">${build.commit || '—'}</div>
          </div>
          <div class="dev-info-card">
            <div class="dev-info-label">Rama</div>
            <div class="dev-info-val" style="font-size:12px;">${build.branch || '—'}</div>
          </div>
          <div class="dev-info-card">
            <div class="dev-info-label">Autor</div>
            <div class="dev-info-val" style="font-size:12px;">${build.author || '—'}</div>
          </div>
          <div class="dev-info-card">
            <div class="dev-info-label">Página</div>
            <div class="dev-info-val" style="font-size:12px;">${getPage()}</div>
          </div>
        </div>
        <div class="dev-section-title">Historial — click para ver detalle</div>
        <div id="devCommitList"><div class="dev-loading"><i class="fa-solid fa-spinner"></i> Cargando...</div></div>
      </div>

      <!-- Tab: PRs -->
      <div class="dev-tab-content" id="devTab-prs">
        <div class="dev-section-title">Pull Requests</div>
        <div id="devPRList"><div class="dev-loading"><i class="fa-solid fa-spinner"></i> Cargando...</div></div>
      </div>

      <!-- Tab: Deploys -->
      <div class="dev-tab-content" id="devTab-deploys">
        <div class="dev-section-title">Entornos</div>
        ${Object.entries(DEPLOYS).map(([key, d]) => `
        <div class="dev-deploy-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="dev-avatar" style="background:${d.color};width:24px;height:24px;font-size:9px;">${d.initials}</div>
              <span style="font-weight:600;color:white;font-size:13px;">${d.label}</span>
            </div>
            <span style="background:${d.color};color:white;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;">
              ${key === 'fusion' ? 'Fusión' : 'Producción'}
            </span>
          </div>
          <a href="https://${d.url}" target="_blank" class="dev-deploy-url">
            <i class="fa-solid fa-arrow-up-right-from-square" style="margin-right:4px;"></i>${d.url}
          </a>
        </div>`).join('')}

        <div class="dev-section-title">Fusionar versiones</div>
        <div style="padding:4px 12px 12px;">
          <div style="background:#1a1a30;border:1px solid #2a2a4a;border-radius:12px;padding:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <span style="font-size:12px;color:#aaa;">Auto-merge</span>
              <div style="display:flex;align-items:center;gap:8px;">
                <span id="devAutoMergeStatus" class="dev-auto-badge dev-auto-off">
                  <i class="fa-solid fa-circle" style="font-size:6px;"></i> Desactivado
                </span>
                <button onclick="VOY_DEV.toggleAutoMerge()" class="dev-action-btn" style="padding:4px 10px;font-size:11px;" id="devAutoMergeBtn">
                  Activar (3 min)
                </button>
              </div>
            </div>
            <button onclick="VOY_DEV.manualMerge()" class="dev-merge-btn" id="devMergeBtn">
              <i class="fa-solid fa-code-merge"></i> Fusionar ahora a voy-app-3
            </button>
            <div id="devMergeLog" style="margin-top:10px;font-size:11px;color:#555;max-height:80px;overflow-y:auto;"></div>
          </div>
        </div>

        <div class="dev-section-title">Ramas activas</div>
        <div id="devBranchList"><div class="dev-loading"><i class="fa-solid fa-spinner"></i> Cargando...</div></div>
        <div class="dev-section-title">Datos en tiempo real</div>
        <div class="dev-stat-row" id="devDataStats">
          <div class="dev-stat-card"><div class="dev-stat-val">—</div><div class="dev-stat-label">Workers</div></div>
          <div class="dev-stat-card"><div class="dev-stat-val">—</div><div class="dev-stat-label">Clientes</div></div>
          <div class="dev-stat-card"><div class="dev-stat-val">—</div><div class="dev-stat-label">Bookings</div></div>
        </div>
      </div>

      <!-- Tab: Tools -->
      <div class="dev-tab-content" id="devTab-tools">
        <div class="dev-section-title">Navegación rápida</div>
        <div class="dev-action-grid">
          <button onclick="VOY_DEV.goTo('/client')" class="dev-action-btn"><i class="fa-solid fa-user"></i> Cliente</button>
          <button onclick="VOY_DEV.goTo('/worker')" class="dev-action-btn"><i class="fa-solid fa-hard-hat"></i> Profesional</button>
          <button onclick="VOY_DEV.goTo('/admin')" class="dev-action-btn"><i class="fa-solid fa-shield-halved"></i> Admin</button>
          <button onclick="VOY_DEV.goTo('/')" class="dev-action-btn"><i class="fa-solid fa-house"></i> Landing</button>
        </div>
        <div class="dev-section-title">Comparar deploys</div>
        <div style="padding:4px 16px 12px;">
          <div style="background:#1a1a30;border:1px solid #2a2a4a;border-radius:12px;overflow:hidden;">
            <div style="display:grid;grid-template-columns:1fr 1fr;text-align:center;">
              <a href="https://${DEPLOYS.sergio.url}" target="_blank"
                 style="padding:12px;color:${DEPLOYS.sergio.color};text-decoration:none;font-weight:600;font-size:12px;border-right:1px solid #2a2a4a;transition:background 0.2s;"
                 onmouseenter="this.style.background='#1a1a40'" onmouseleave="this.style.background='transparent'">
                <i class="fa-solid fa-arrow-up-right-from-square" style="margin-right:4px;"></i>Sergio
              </a>
              <a href="https://${DEPLOYS.guillermo.url}" target="_blank"
                 style="padding:12px;color:${DEPLOYS.guillermo.color};text-decoration:none;font-weight:600;font-size:12px;transition:background 0.2s;"
                 onmouseenter="this.style.background='#1a1a40'" onmouseleave="this.style.background='transparent'">
                <i class="fa-solid fa-arrow-up-right-from-square" style="margin-right:4px;"></i>Guillermo
              </a>
            </div>
          </div>
        </div>
        <div class="dev-section-title">Acciones</div>
        <div class="dev-action-grid">
          <button onclick="VOY_DEV.clearCache()" class="dev-action-btn" style="grid-column:span 2;">
            <i class="fa-solid fa-trash-can"></i> Limpiar caché y recargar
          </button>
          <button onclick="VOY_DEV.openRepo()" class="dev-action-btn" style="grid-column:span 2;">
            <i class="fa-brands fa-github"></i> Abrir repositorio
          </button>
        </div>
        <div class="dev-section-title">Cuentas de prueba</div>
        <div style="padding:4px 16px 16px;">
          <div style="background:#1a1a30;border:1px solid #2a2a4a;border-radius:10px;padding:12px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a4a;">
              <span style="color:#888;">Cliente</span>
              <span style="color:#e0e0e0;">sofia.mendoza@gmail.com · demo1234</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #2a2a4a;">
              <span style="color:#888;">Profesional</span>
              <span style="color:#e0e0e0;">carlos.munoz@gmail.com · demo1234</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;">
              <span style="color:#888;">Admin</span>
              <span style="color:#e0e0e0;">admin@voy.cl · voy2026</span>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    updateDataStats();
  }

  /* ── GitHub API ────────────────────────────── */
  async function loadGitHubData() {
    try {
      const [commitsRes, prsRes, branchesRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${REPO}/commits?per_page=15`),
        fetch(`https://api.github.com/repos/${REPO}/pulls?state=all&per_page=10`),
        fetch(`https://api.github.com/repos/${REPO}/branches?per_page=10`),
      ]);
      const [commits, prs, branches] = await Promise.all([
        commitsRes.json(), prsRes.json(), branchesRes.json(),
      ]);
      commitsCache = commits;
      renderCommits(commits);
      renderPRs(prs);
      renderBranches(branches);
    } catch (e) {
      console.error('Dev panel: error cargando GitHub', e);
      document.getElementById('devCommitList').innerHTML =
        '<div style="padding:16px;color:#555;text-align:center;">Error cargando datos de GitHub</div>';
    }
  }

  function renderCommits(commits) {
    const el = document.getElementById('devCommitList');
    if (!el || !Array.isArray(commits)) return;
    el.innerHTML = commits.map((c, i) => {
      const author = c.commit?.author?.name || c.author?.login || '?';
      const msg = c.commit?.message?.split('\n')[0] || '';
      const fullMsg = c.commit?.message || '';
      const date = c.commit?.author?.date || '';
      const sha = c.sha?.slice(0, 7) || '';
      const color = getAuthorColor(author);
      const initials = getAuthorInitials(author);
      return `
        <div class="dev-commit" onclick="VOY_DEV.toggleCommitDetail(${i}, '${c.sha}')">
          <div class="dev-commit-header">
            <div class="dev-avatar" style="background:${color};">${initials}</div>
            <div class="dev-commit-msg" title="${escapeHtml(msg)}">${escapeHtml(msg)}</div>
            <i class="fa-solid fa-chevron-down" style="color:#444;font-size:10px;transition:transform 0.2s;" id="devChevron-${i}"></i>
          </div>
          <div class="dev-commit-meta">
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(author)}</span>
            <span><i class="fa-solid fa-clock"></i> ${timeAgo(date)}</span>
            <span><i class="fa-solid fa-hashtag"></i> ${sha}</span>
          </div>
        </div>
        <div id="devDetail-${i}" style="display:none;"></div>`;
    }).join('');
  }

  async function toggleCommitDetail(index, sha) {
    const el = document.getElementById(`devDetail-${index}`);
    const chevron = document.getElementById(`devChevron-${index}`);
    if (!el) return;

    if (el.style.display === 'block') {
      el.style.display = 'none';
      if (chevron) chevron.style.transform = 'rotate(0)';
      return;
    }

    if (chevron) chevron.style.transform = 'rotate(180deg)';
    el.style.display = 'block';
    el.innerHTML = '<div class="dev-commit-detail"><div class="dev-commit-detail-body"><div class="dev-loading" style="padding:8px;"><i class="fa-solid fa-spinner"></i> Cargando...</div></div></div>';

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${sha}`);
      const data = await res.json();
      const files = data.files || [];
      const fullMsg = data.commit?.message || '';
      const msgLines = fullMsg.split('\n').filter(l => l.trim());
      const additions = data.stats?.additions || 0;
      const deletions = data.stats?.deletions || 0;

      el.innerHTML = `
        <div class="dev-commit-detail">
          <div class="dev-commit-detail-body">
            ${msgLines.length > 1 ? `<div style="color:#aaa;margin-bottom:8px;line-height:1.5;font-size:12px;">${msgLines.slice(1).map(l => escapeHtml(l)).join('<br>')}</div>` : ''}
            <div style="font-size:11px;font-weight:600;color:#666;margin-bottom:6px;">Archivos modificados (${files.length})</div>
            ${files.slice(0, 15).map(f => {
              const icon = f.status === 'added' ? 'fa-plus' : f.status === 'removed' ? 'fa-minus' : 'fa-pen';
              const cls = f.status === 'added' ? 'dev-file-add' : f.status === 'removed' ? 'dev-file-del' : 'dev-file-mod';
              return `<div class="dev-file-item ${cls}"><i class="fa-solid ${icon}" style="width:12px;font-size:9px;"></i> ${f.filename} <span style="margin-left:auto;font-size:10px;color:#555;">+${f.additions} -${f.deletions}</span></div>`;
            }).join('')}
            ${files.length > 15 ? `<div style="color:#555;font-size:11px;padding:4px 0;">...y ${files.length - 15} archivos más</div>` : ''}
          </div>
          <div class="dev-commit-stats">
            <span style="color:#34d399;"><i class="fa-solid fa-plus"></i> ${additions} adiciones</span>
            <span style="color:#EF4444;"><i class="fa-solid fa-minus"></i> ${deletions} eliminaciones</span>
            <span style="color:#888;"><i class="fa-solid fa-file"></i> ${files.length} archivos</span>
          </div>
        </div>`;
    } catch (e) {
      el.innerHTML = '<div class="dev-commit-detail"><div class="dev-commit-detail-body" style="color:#555;">Error cargando detalle</div></div>';
    }
  }

  function renderPRs(prs) {
    const el = document.getElementById('devPRList');
    if (!el || !Array.isArray(prs)) return;
    if (prs.length === 0) {
      el.innerHTML = '<div style="padding:16px;color:#555;text-align:center;">Sin PRs</div>';
      return;
    }
    el.innerHTML = prs.map(pr => {
      const isMerged = pr.merged_at;
      const isOpen = pr.state === 'open';
      const iconClass = isMerged ? 'dev-pr-merged' : isOpen ? 'dev-pr-open' : 'dev-pr-closed';
      const icon = isMerged ? 'fa-code-merge' : isOpen ? 'fa-code-pull-request' : 'fa-xmark';
      const statusColor = isMerged ? '#8B5CF6' : isOpen ? '#10B981' : '#EF4444';
      const statusText = isMerged ? 'Merged' : isOpen ? 'Open' : 'Closed';
      return `
        <div class="dev-pr" onclick="window.open('${pr.html_url}','_blank')">
          <div class="dev-pr-icon ${iconClass}">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:#e0e0e0;">#${pr.number} ${escapeHtml(pr.title)}</div>
            <div style="font-size:11px;color:#555;margin-top:4px;display:flex;align-items:center;gap:8px;">
              <span>${pr.user?.login || '?'}</span>
              <span>${timeAgo(pr.created_at)}</span>
              <span style="color:${statusColor};font-weight:600;">${statusText}</span>
              ${pr.head?.ref ? `<span class="dev-branch-tag" style="font-size:9px;padding:1px 6px;">${pr.head.ref}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderBranches(branches) {
    const el = document.getElementById('devBranchList');
    if (!el || !Array.isArray(branches)) return;
    el.innerHTML = '<div style="padding:4px 16px 12px;display:flex;flex-wrap:wrap;gap:6px;">' +
      branches.map(b => {
        const color = b.name === 'main' ? '#10B981' : b.name.startsWith('guillermo') ? '#10B981' : b.name.startsWith('sergio') ? '#0EA5E9' : '#F59E0B';
        return `<span class="dev-branch-tag" style="background:${color}20;color:${color};border:1px solid ${color}40;">${b.name}</span>`;
      }).join('') + '</div>';
  }

  function updateDataStats() {
    const check = () => {
      const el = document.getElementById('devDataStats');
      if (!el) return;
      if (typeof VOY_DATA !== 'undefined' && VOY_DATA.workers.length > 0) {
        el.innerHTML = `
          <div class="dev-stat-card"><div class="dev-stat-val">${VOY_DATA.workers.length}</div><div class="dev-stat-label">Workers</div></div>
          <div class="dev-stat-card"><div class="dev-stat-val">${VOY_DATA.clients.length}</div><div class="dev-stat-label">Clientes</div></div>
          <div class="dev-stat-card"><div class="dev-stat-val">${VOY_DATA.bookings.length}</div><div class="dev-stat-label">Bookings</div></div>`;
      } else { setTimeout(check, 2000); }
    };
    check();
  }

  /* ── Merge / Fusión ────────────────────────── */
  function addMergeLog(msg) {
    const el = document.getElementById('devMergeLog');
    if (!el) return;
    const time = new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    el.innerHTML = `<div style="padding:2px 0;"><span style="color:#8B5CF6;">[${time}]</span> ${msg}</div>` + el.innerHTML;
  }

  async function manualMerge() {
    const btn = document.getElementById('devMergeBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fusionando...'; }

    addMergeLog('Iniciando fusión manual...');
    addMergeLog(`Fuente: <span style="color:#0EA5E9;">Sergio/main</span> + <span style="color:#10B981;">Guillermo/dev-panel</span>`);

    // Simular merge (en producción real esto usaría GitHub API con token)
    await new Promise(r => setTimeout(r, 1500));
    addMergeLog('<span style="color:#10B981;">Fusión completada</span> — deploy a voy-app-3 en curso');
    addMergeLog('Resultado disponible en <span style="color:#8B5CF6;">voy-app-3.vercel.app</span>');

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-code-merge"></i> Fusionar ahora a voy-app-3'; }
  }

  function toggleAutoMerge() {
    const status = document.getElementById('devAutoMergeStatus');
    const btn = document.getElementById('devAutoMergeBtn');

    if (mergeTimer) {
      clearInterval(mergeTimer);
      mergeTimer = null;
      if (status) status.className = 'dev-auto-badge dev-auto-off';
      if (status) status.innerHTML = '<i class="fa-solid fa-circle" style="font-size:6px;"></i> Desactivado';
      if (btn) btn.textContent = 'Activar (3 min)';
      addMergeLog('Auto-merge <span style="color:#EF4444;">desactivado</span>');
    } else {
      mergeTimer = setInterval(() => { manualMerge(); }, 180000); // 3 minutos
      if (status) status.className = 'dev-auto-badge dev-auto-on';
      if (status) status.innerHTML = '<i class="fa-solid fa-circle" style="font-size:6px;"></i> Cada 3 min';
      if (btn) btn.textContent = 'Desactivar';
      addMergeLog('Auto-merge <span style="color:#10B981;">activado</span> — cada 3 minutos');
    }
  }

  /* ── Acciones ─────────────────────────────── */
  function togglePanel() { document.getElementById('devPanel')?.classList.toggle('open'); }
  function close() { document.getElementById('devPanel')?.classList.remove('open'); }
  function goTo(path) { window.location.href = path; }
  function clearCache() { localStorage.clear(); sessionStorage.clear(); location.reload(); }
  function openRepo() { window.open(`https://github.com/${REPO}`, '_blank'); }

  function switchTab(name) {
    document.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dev-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.dev-tab[onclick*="${name}"]`)?.classList.add('active');
    document.getElementById(`devTab-${name}`)?.classList.add('active');
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { togglePanel, close, goTo, clearCache, openRepo, switchTab, getEnv,
           toggleCommitDetail, manualMerge, toggleAutoMerge };
})();
