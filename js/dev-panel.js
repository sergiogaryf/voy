/* ============================================
   VOY — Panel de Desarrollador v2
   Historial real desde GitHub + info de build
   ============================================ */

const VOY_DEV = (() => {
  const REPO = 'sergiogaryf/voy';
  const DEPLOYS = {
    sergio:    'voy-app1.vercel.app',
    guillermo: 'voy-app-2.vercel.app',
  };

  // Detectar entorno
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

  function init() {
    injectStyles();
    createToggleButton();
    createPanel();
    loadGitHubData();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #devPanel { position:fixed; bottom:80px; right:20px; z-index:9999; width:400px; max-height:85vh;
        background:#0f0f1a; color:#e0e0e0; border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.6);
        font-family:'Inter',sans-serif; font-size:13px; overflow:hidden;
        transform:translateY(20px) scale(0.95); opacity:0; pointer-events:none; transition:all 0.3s cubic-bezier(0.4,0,0.2,1); }
      #devPanel.open { transform:translateY(0) scale(1); opacity:1; pointer-events:auto; }
      #devToggleBtn { position:fixed; bottom:20px; right:20px; z-index:10000; width:50px; height:50px;
        border-radius:50%; border:none; background:linear-gradient(135deg,#8B5CF6,#6D28D9); color:white;
        font-size:1.2rem; cursor:pointer; box-shadow:0 4px 20px rgba(109,40,217,0.5);
        transition:all 0.3s ease; display:flex; align-items:center; justify-content:center; }
      #devToggleBtn:hover { transform:scale(1.1) rotate(10deg); box-shadow:0 6px 24px rgba(109,40,217,0.6); }
      .dev-header { padding:16px 20px; background:linear-gradient(135deg,#1a1a3e,#2a1a4e);
        display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #2a2a4a; }
      .dev-tabs { display:flex; background:#1a1a2e; border-bottom:1px solid #2a2a4a; padding:0 12px; }
      .dev-tab { padding:10px 16px; font-size:12px; font-weight:600; color:#666; cursor:pointer;
        border-bottom:2px solid transparent; transition:all 0.2s; }
      .dev-tab:hover { color:#aaa; }
      .dev-tab.active { color:#8B5CF6; border-bottom-color:#8B5CF6; }
      .dev-tab-content { display:none; overflow-y:auto; max-height:calc(85vh - 140px); }
      .dev-tab-content.active { display:block; }
      .dev-commit { padding:12px 16px; border-bottom:1px solid #1a1a2e; transition:background 0.15s; cursor:default; }
      .dev-commit:hover { background:#1a1a30; }
      .dev-commit-header { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
      .dev-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center;
        justify-content:center; font-size:10px; font-weight:700; color:white; flex-shrink:0; }
      .dev-commit-msg { font-size:13px; font-weight:600; color:#e0e0e0; line-height:1.3;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
      .dev-commit-meta { display:flex; align-items:center; gap:12px; font-size:11px; color:#555; margin-left:38px; }
      .dev-commit-meta i { width:12px; }
      .dev-branch-tag { background:#2a2a4a; color:#8B5CF6; padding:1px 8px; border-radius:10px; font-size:10px; font-weight:600; }
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
      .dev-stat-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; padding:12px 16px; }
      .dev-stat-card { background:#1a1a30; padding:8px; border-radius:8px; text-align:center; border:1px solid #2a2a4a; }
      .dev-stat-val { font-weight:700; font-size:18px; color:white; }
      .dev-stat-label { font-size:9px; color:#555; text-transform:uppercase; margin-top:2px; }
      .dev-section-title { padding:12px 16px 4px; font-size:11px; font-weight:700; color:#444;
        text-transform:uppercase; letter-spacing:0.08em; }
      .dev-pr { padding:12px 16px; border-bottom:1px solid #1a1a2e; display:flex; align-items:center; gap:10px; }
      .dev-pr-icon { width:28px; height:28px; border-radius:50%; display:flex; align-items:center;
        justify-content:center; font-size:12px; flex-shrink:0; }
      .dev-pr-open { background:#1a3a1a; color:#10B981; }
      .dev-pr-merged { background:#2a1a4a; color:#8B5CF6; }
      .dev-pr-title { font-size:13px; font-weight:600; color:#e0e0e0; flex:1; }
      .dev-loading { text-align:center; padding:24px; color:#555; }
      .dev-loading i { animation:spin 1s linear infinite; }
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
          <span style="font-size:10px;color:#555;">v2</span>
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
          <i class="fa-solid fa-code-commit" style="margin-right:4px;"></i>Commits
        </div>
        <div class="dev-tab" onclick="VOY_DEV.switchTab('prs')">
          <i class="fa-solid fa-code-pull-request" style="margin-right:4px;"></i>PRs
        </div>
        <div class="dev-tab" onclick="VOY_DEV.switchTab('deploys')">
          <i class="fa-solid fa-rocket" style="margin-right:4px;"></i>Deploys
        </div>
        <div class="dev-tab" onclick="VOY_DEV.switchTab('tools')">
          <i class="fa-solid fa-wrench" style="margin-right:4px;"></i>Tools
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
        <div class="dev-section-title">Historial de commits</div>
        <div id="devCommitList"><div class="dev-loading"><i class="fa-solid fa-spinner"></i> Cargando...</div></div>
      </div>

      <!-- Tab: PRs -->
      <div class="dev-tab-content" id="devTab-prs">
        <div class="dev-section-title">Pull Requests</div>
        <div id="devPRList"><div class="dev-loading"><i class="fa-solid fa-spinner"></i> Cargando...</div></div>
      </div>

      <!-- Tab: Deploys -->
      <div class="dev-tab-content" id="devTab-deploys">
        <div class="dev-section-title">Entornos de deploy</div>
        <div class="dev-deploy-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="dev-avatar" style="background:#10B981;width:24px;height:24px;font-size:9px;">GG</div>
              <span style="font-weight:600;color:white;font-size:13px;">Guillermo</span>
            </div>
            <span style="background:#10B981;color:white;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;">Producción</span>
          </div>
          <a href="https://${DEPLOYS.guillermo}" target="_blank" class="dev-deploy-url">
            <i class="fa-solid fa-arrow-up-right-from-square" style="margin-right:4px;"></i>${DEPLOYS.guillermo}
          </a>
        </div>
        <div class="dev-deploy-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="dev-avatar" style="background:#0EA5E9;width:24px;height:24px;font-size:9px;">SG</div>
              <span style="font-weight:600;color:white;font-size:13px;">Sergio</span>
            </div>
            <span style="background:#0EA5E9;color:white;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;">Producción</span>
          </div>
          <a href="https://${DEPLOYS.sergio}" target="_blank" class="dev-deploy-url">
            <i class="fa-solid fa-arrow-up-right-from-square" style="margin-right:4px;"></i>${DEPLOYS.sergio}
          </a>
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
        <div class="dev-section-title">Acciones</div>
        <div class="dev-action-grid">
          <button onclick="VOY_DEV.clearCache()" class="dev-action-btn" style="grid-column:span 2;">
            <i class="fa-solid fa-trash-can"></i> Limpiar caché y recargar
          </button>
          <button onclick="VOY_DEV.openRepo()" class="dev-action-btn" style="grid-column:span 2;">
            <i class="fa-brands fa-github"></i> Abrir repositorio en GitHub
          </button>
          <button onclick="VOY_DEV.compareDevs()" class="dev-action-btn" style="grid-column:span 2;">
            <i class="fa-solid fa-code-compare"></i> Comparar Sergio vs Guillermo
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

  /* ── GitHub API (repo público, sin auth) ─── */
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
    el.innerHTML = commits.map(c => {
      const author = c.commit?.author?.name || c.author?.login || '?';
      const msg = c.commit?.message?.split('\n')[0] || '';
      const date = c.commit?.author?.date || '';
      const sha = c.sha?.slice(0, 7) || '';
      const color = getAuthorColor(author);
      const initials = getAuthorInitials(author);
      return `
        <div class="dev-commit">
          <div class="dev-commit-header">
            <div class="dev-avatar" style="background:${color};">${initials}</div>
            <div class="dev-commit-msg" title="${msg}">${msg}</div>
          </div>
          <div class="dev-commit-meta">
            <span><i class="fa-solid fa-user"></i> ${author}</span>
            <span><i class="fa-solid fa-clock"></i> ${timeAgo(date)}</span>
            <span><i class="fa-solid fa-hashtag"></i> ${sha}</span>
          </div>
        </div>`;
    }).join('');
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
      const iconClass = isMerged ? 'dev-pr-merged' : isOpen ? 'dev-pr-open' : '';
      const icon = isMerged ? 'fa-code-merge' : isOpen ? 'fa-code-pull-request' : 'fa-xmark';
      const statusColor = isMerged ? '#8B5CF6' : isOpen ? '#10B981' : '#EF4444';
      const statusText = isMerged ? 'Merged' : isOpen ? 'Open' : 'Closed';
      return `
        <div class="dev-pr" onclick="window.open('${pr.html_url}','_blank')" style="cursor:pointer;">
          <div class="dev-pr-icon ${iconClass}">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div style="flex:1;">
            <div class="dev-pr-title">#${pr.number} ${pr.title}</div>
            <div style="font-size:11px;color:#555;margin-top:2px;">
              ${pr.user?.login || '?'} · ${timeAgo(pr.created_at)}
              <span style="color:${statusColor};margin-left:8px;font-weight:600;">${statusText}</span>
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
        const isMain = b.name === 'main';
        const color = isMain ? '#10B981' : b.name.startsWith('guillermo') ? '#10B981' : b.name.startsWith('sergio') ? '#0EA5E9' : '#F59E0B';
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
      } else {
        setTimeout(check, 2000);
      }
    };
    check();
  }

  /* ── Acciones ─────────────────────────────── */
  function togglePanel() {
    document.getElementById('devPanel')?.classList.toggle('open');
  }
  function close() { document.getElementById('devPanel')?.classList.remove('open'); }
  function goTo(path) { window.location.href = path; }
  function clearCache() { localStorage.clear(); sessionStorage.clear(); location.reload(); }
  function openRepo() { window.open(`https://github.com/${REPO}`, '_blank'); }
  function compareDevs() {
    window.open(`https://${DEPLOYS.sergio}`, '_blank');
    window.open(`https://${DEPLOYS.guillermo}`, '_blank');
  }

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

  return { togglePanel, close, goTo, clearCache, openRepo, compareDevs, switchTab, getEnv };
})();
