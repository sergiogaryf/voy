/* ============================================
   VOY — Módulo de Autenticación
   Sesión via localStorage + SHA-256 (Web Crypto)
   ============================================ */

const VoyAuth = (() => {
  const SESSION_KEY = 'voy_session';

  /* ── SHA-256 con Web Crypto API ─────────── */
  async function hashPassword(password) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* ── Sesión ──────────────────────────────── */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /* ── Proteger ruta por rol ───────────────── */
  function requireRole(role) {
    const session = getSession();
    if (!session) {
      window.location.href = '/login/';
      return null;
    }
    if (session.role !== role) {
      const routes = {
        cliente:      '/client/',
        profesional:  '/worker/',
        admin:        '/admin/',
      };
      window.location.href = routes[session.role] || '/login/';
      return null;
    }
    return session;
  }

  /* ── Login ───────────────────────────────── */
  async function login(email, password) {
    const hash = await hashPassword(password);

    // Admin check (credenciales en config.js — no en Airtable)
    const adminCfg = VOY_CONFIG?.admin;
    if (adminCfg && email.toLowerCase() === adminCfg.email.toLowerCase()) {
      const adminHash = await hashPassword(adminCfg.password);
      if (hash === adminHash) {
        const session = {
          role: 'admin', recordId: null, id: null,
          name: 'Admin VOY', avatar: 'https://i.pravatar.cc/40?img=60', email,
        };
        saveSession(session);
        return session;
      }
      throw new Error('Credenciales inválidas');
    }

    // Buscar en Workers
    const worker = await VoyDB.getWorkerByEmail(email.toLowerCase());
    if (worker) {
      if (worker.passwordHash === hash) {
        const session = {
          role: 'profesional',
          recordId: worker._recordId,
          id: worker.id,
          name: worker.name,
          avatar: worker.avatar || 'https://i.pravatar.cc/40?img=15',
          email,
        };
        saveSession(session);
        return session;
      }
      throw new Error('Contraseña incorrecta');
    }

    // Buscar en Clients
    const client = await VoyDB.getClientByEmail(email.toLowerCase());
    if (client) {
      if (client.passwordHash === hash) {
        const session = {
          role: 'cliente',
          recordId: client._recordId,
          id: client.id,
          name: client.name,
          avatar: client.avatar || 'https://i.pravatar.cc/40?img=47',
          email,
        };
        saveSession(session);
        return session;
      }
      throw new Error('Contraseña incorrecta');
    }

    throw new Error('No existe una cuenta con ese email');
  }

  /* ── Registro ────────────────────────────── */
  async function register(data) {
    // Verificar que el email no exista
    const [existingWorker, existingClient] = await Promise.all([
      VoyDB.getWorkerByEmail(data.email.toLowerCase()),
      VoyDB.getClientByEmail(data.email.toLowerCase()),
    ]);
    if (existingWorker || existingClient) {
      throw new Error('Ya existe una cuenta con ese email');
    }

    const hash = await hashPassword(data.password);

    if (data.role === 'profesional') {
      const worker = await VoyDB.createWorkerAccount({
        name:         data.name,
        email:        data.email.toLowerCase(),
        passwordHash: hash,
        city:         data.city  || 'Viña del Mar',
        phone:        data.phone || '',
        category:     data.category || 'other',
      });
      const session = {
        role: 'profesional',
        recordId: worker._recordId,
        id: worker.id,
        name: worker.name,
        avatar: worker.avatar || 'https://i.pravatar.cc/40?img=15',
        email: data.email.toLowerCase(),
      };
      saveSession(session);
      sendWelcomeEmail(data.email.toLowerCase(), data.name);
      return session;
    } else {
      const client = await VoyDB.createClientAccount({
        name:         data.name,
        email:        data.email.toLowerCase(),
        passwordHash: hash,
        city:         data.city  || 'Viña del Mar',
        phone:        data.phone || '',
      });
      const session = {
        role: 'cliente',
        recordId: client._recordId,
        id: client.id,
        name: client.name,
        avatar: client.avatar || 'https://i.pravatar.cc/40?img=47',
        email: data.email.toLowerCase(),
      };
      saveSession(session);
      sendWelcomeEmail(data.email.toLowerCase(), data.name);
      return session;
    }
  }

  /* ── Email de bienvenida (async, no bloquea) */
  function sendWelcomeEmail(email, name) {
    fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, type: 'welcome', name }),
    }).catch(() => {}); // No bloquear si falla
  }

  /* ── Logout ──────────────────────────────── */
  function logout() {
    clearSession();
    window.location.href = '/login/';
  }

  /* ── Poblar UI con datos de sesión ───────── */
  function applySessionToUI(session) {
    if (!session) return;
    // Avatar
    document.querySelectorAll('.session-avatar').forEach(el => {
      el.src = session.avatar;
    });
    // Nombre
    document.querySelectorAll('.session-name').forEach(el => {
      el.textContent = session.name;
    });
    // Sub (email)
    document.querySelectorAll('.session-email').forEach(el => {
      el.textContent = session.email;
    });
  }

  return {
    hashPassword,
    getSession, saveSession, clearSession,
    requireRole,
    login, register, logout,
    applySessionToUI,
  };
})();
