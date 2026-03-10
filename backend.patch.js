(function () {
  'use strict';

  if (!window.__BACKEND_MODE__) return;

  const USER_STORAGE_KEY = 'yucarro_users_v1';
  const CURRENT_USER_KEY = 'yucarro_current_user_v1';
  const LINK_MAP = {
    cpk: 'yucarro_cpk_url',
    scrap: 'yucarro_scrap_url',
    scrapCredit: 'yucarro_scrap_credit_url',
    wash: 'yucarro_wash_url',
    washHist: 'yucarro_wash_hist_url',
    extra: 'yucarro_extra_url',
    lossY: 'yucarro_loss_y_url',
    lossT: 'yucarro_loss_t_url',
    lossC: 'yucarro_loss_c_url'
  };

  function normalizeUser(u) {
    if (!u || typeof u !== 'object') return null;
    return {
      username: (u.username || '').toString().trim(),
      password: '',
      role: (u.role || 'viewer').toString().trim(),
      modules: Array.isArray(u.modules) ? u.modules : [],
      linkAccess: Array.isArray(u.linkAccess) ? u.linkAccess : []
    };
  }

  function getUsersCache() {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function setUsersCache(users) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(Array.isArray(users) ? users : []));
  }

  function setCurrentUserCache(username) {
    if (username) localStorage.setItem(CURRENT_USER_KEY, username);
    else localStorage.removeItem(CURRENT_USER_KEY);
    if (typeof window.setCurrentUser === 'function') window.setCurrentUser(username || '');
  }

  function writeLinksCache(links) {
    if (!links || typeof links !== 'object') return;
    Object.entries(LINK_MAP).forEach(([apiKey, lsKey]) => {
      if (typeof links[apiKey] === 'string' && links[apiKey].trim()) {
        localStorage.setItem(lsKey, links[apiKey].trim());
      }
    });
  }

  function applyBootstrap(payload) {
    const me = payload && payload.me ? normalizeUser(payload.me) : null;
    let users = Array.isArray(payload && payload.users) ? payload.users.map(normalizeUser).filter(Boolean) : [];
    if (me && !users.some(u => u.username === me.username)) users = [me, ...users];

    setUsersCache(users);
    setCurrentUserCache(me ? me.username : '');
    writeLinksCache(payload && payload.links ? payload.links : null);
  }

  async function api(path, options) {
    const cfg = options || {};
    const BASE_URL = 'https://dashyucarroback.fly.dev';
    const response = await fetch(`${BASE_URL}${path}`, {
      method: cfg.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.headers || {})
      },
      credentials: 'include',
      body: cfg.body ? JSON.stringify(cfg.body) : undefined
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Error HTTP ${response.status}`);
    }
    return data;
  }

  function setMainLoginError(msg) {
    const err = document.getElementById('mainLoginError');
    if (!err) return;
    if (!msg) {
      err.classList.add('hidden');
      err.innerHTML = '';
      return;
    }
    err.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
    err.classList.remove('hidden');
  }

  function setLinksLoginError(msg) {
    const err = document.getElementById('loginError');
    if (!err) return;
    if (!msg) {
      err.classList.add('hidden');
      err.innerHTML = '';
      return;
    }
    err.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
    err.classList.remove('hidden');
  }

  function setUsersError(msg) {
    const el = document.getElementById('usersAdminError');
    if (!el) return;
    if (!msg) {
      el.classList.add('hidden');
      el.innerText = '';
      return;
    }
    el.innerText = msg;
    el.classList.remove('hidden');
  }

  function log(msg, type) {
    if (typeof window.logStatus === 'function') window.logStatus(msg, type || 'info');
  }

  function refreshUserUiAfterLogin() {
    if (typeof window.applyUserAccessControl === 'function') window.applyUserAccessControl();
    if (typeof window.hideLockScreen === 'function') window.hideLockScreen();
    if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
  }

  function getCheckedValues(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return [];
    return Array.from(c.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
  }

  function applyLinksToInputs(links) {
    if (!links || typeof links !== 'object') return;
    const mapInput = {
      cpk: 'inputUrlCpk',
      scrap: 'inputUrlScrap',
      scrapCredit: 'inputUrlScrapCredit',
      wash: 'inputUrlWash',
      washHist: 'inputUrlWashHistory',
      extra: 'inputUrlExtra',
      lossY: 'inputUrlLossY',
      lossT: 'inputUrlLossT',
      lossC: 'inputUrlLossC'
    };
    Object.entries(mapInput).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el && typeof links[key] === 'string') el.value = links[key];
    });
  }

  async function refreshBootstrap() {
    const data = await api('/api/bootstrap');
    applyBootstrap(data);
    if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
    if (typeof window.applyUserAccessControl === 'function') window.applyUserAccessControl();
    return data;
  }

  const originalLogout = window.logoutSession;

  window.attemptMainLogin = async function () {
    const u = (document.getElementById('mainUser')?.value || '').trim();
    const p = (document.getElementById('mainPass')?.value || '').trim();
    if (!u || !p) {
      setMainLoginError('Captura usuario y contraseña.');
      return;
    }

    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { username: u, password: p } });
      applyBootstrap(data);
      setMainLoginError('');
      refreshUserUiAfterLogin();
      log('Sesión iniciada correctamente.', 'info');
    } catch (e) {
      setMainLoginError(e.message || 'Acceso denegado.');
    }
  };

  window.attemptLogin = async function () {
    const u = (document.getElementById('loginUser')?.value || '').trim();
    const p = (document.getElementById('loginPass')?.value || '').trim();
    if (!u || !p) {
      setLinksLoginError('Captura usuario y contraseña.');
      return;
    }

    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { username: u, password: p } });
      applyBootstrap(data);
      setLinksLoginError('');

      const me = data && data.me ? data.me : null;
      const canOpenLinks = !!(me && (me.role === 'admin' || (Array.isArray(me.linkAccess) && me.linkAccess.length > 0)));
      if (!canOpenLinks) {
        setLinksLoginError('Sin permisos para Edición de enlaces CSV.');
        return;
      }

      if (typeof window.toggleModal === 'function') {
        window.toggleModal('loginModal');
        setTimeout(() => window.toggleModal('cloudModal'), 180);
      }
      refreshUserUiAfterLogin();
    } catch (e) {
      setLinksLoginError(e.message || 'Credenciales inválidas.');
    }
  };

  window.logoutSession = async function () {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (_) {
      // no-op
    }

    if (typeof originalLogout === 'function') {
      originalLogout();
      return;
    }

    setCurrentUserCache('');
    if (typeof window.applyUserAccessControl === 'function') window.applyUserAccessControl();
    if (typeof window.showLockScreen === 'function') window.showLockScreen();
  };

  window.saveCloudConfig = async function () {
    const body = {
      cpk: (document.getElementById('inputUrlCpk')?.value || '').trim(),
      scrap: (document.getElementById('inputUrlScrap')?.value || '').trim(),
      scrapCredit: (document.getElementById('inputUrlScrapCredit')?.value || '').trim(),
      wash: (document.getElementById('inputUrlWash')?.value || '').trim(),
      washHist: (document.getElementById('inputUrlWashHistory')?.value || '').trim(),
      extra: (document.getElementById('inputUrlExtra')?.value || '').trim(),
      lossY: (document.getElementById('inputUrlLossY')?.value || '').trim(),
      lossT: (document.getElementById('inputUrlLossT')?.value || '').trim(),
      lossC: (document.getElementById('inputUrlLossC')?.value || '').trim()
    };

    try {
      const data = await api('/api/links', { method: 'PUT', body });
      writeLinksCache(data.links || {});
      applyLinksToInputs(data.links || {});
      if (typeof window.toggleModal === 'function') window.toggleModal('cloudModal');
      if (typeof window.manualRefresh === 'function') window.manualRefresh();
      log('Enlaces guardados en servidor.', 'info');
    } catch (e) {
      log(e.message || 'No se pudieron guardar los enlaces.', 'error');
    }
  };

  window.resetToDefaults = async function () {
    if (!window.confirm('¿Seguro que deseas restaurar enlaces por defecto?')) return;
    try {
      const data = await api('/api/links/reset', { method: 'POST', body: {} });
      writeLinksCache(data.links || {});
      applyLinksToInputs(data.links || {});
      if (typeof window.manualRefresh === 'function') window.manualRefresh();
      log('Enlaces restaurados a valores por defecto.', 'info');
    } catch (e) {
      log(e.message || 'No se pudieron restaurar los enlaces.', 'error');
    }
  };

  window.saveUserFromForm = async function () {
    const idxRaw = (document.getElementById('userEditIndex')?.value || '').trim();
    const username = (document.getElementById('userFormUsername')?.value || '').trim();
    const password = (document.getElementById('userFormPassword')?.value || '').trim();
    const role = (document.getElementById('userFormRole')?.value || 'editor').trim();
    const modules = getCheckedValues('userFormModuleAccess');
    const linkAccess = getCheckedValues('userFormLinkAccess');

    setUsersError('');

    if (!username) {
      setUsersError('Usuario es obligatorio.');
      return;
    }
    if (idxRaw === '' && !password) {
      setUsersError('Para crear usuario, captura contraseña.');
      return;
    }
    if (role !== 'admin' && modules.length === 0) {
      setUsersError('Selecciona al menos un módulo visible para el usuario.');
      return;
    }

    const idx = idxRaw === '' ? -1 : parseInt(idxRaw, 10);
    const users = getUsersCache();
    const original = (idx >= 0 && idx < users.length) ? users[idx] : null;

    const payload = {
      originalUsername: original ? original.username : '',
      username,
      role,
      modules,
      linkAccess
    };
    if (password) payload.password = password;

    try {
      const data = await api('/api/users/upsert', { method: 'POST', body: payload });
      const freshUsers = Array.isArray(data.users) ? data.users.map(normalizeUser).filter(Boolean) : [];
      setUsersCache(freshUsers);
      if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
      if (typeof window.resetUserForm === 'function') window.resetUserForm();
      if (typeof window.applyUserAccessControl === 'function') window.applyUserAccessControl();
      log('Usuario guardado en servidor.', 'info');
    } catch (e) {
      setUsersError(e.message || 'No se pudo guardar el usuario.');
    }
  };

  window.editUserFromTable = function (idx) {
    const users = getUsersCache();
    const user = users[idx];
    if (!user) return;

    const edit = document.getElementById('userEditIndex');
    const title = document.getElementById('usersFormTitle');
    const u = document.getElementById('userFormUsername');
    const p = document.getElementById('userFormPassword');
    const r = document.getElementById('userFormRole');

    if (edit) edit.value = String(idx);
    if (title) title.innerText = `Editar usuario: ${user.username}`;
    if (u) u.value = user.username;
    if (p) p.value = '';
    if (r) r.value = user.role || 'editor';

    const mod = document.getElementById('userFormModuleAccess');
    const link = document.getElementById('userFormLinkAccess');
    if (mod) {
      mod.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = (user.modules || []).includes(cb.value); });
    }
    if (link) {
      link.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = (user.linkAccess || []).includes(cb.value); });
    }
    if (typeof window.handleUserRoleChange === 'function') window.handleUserRoleChange();
    setUsersError('');
  };

  window.deleteUserFromTable = async function (idx) {
    const users = getUsersCache();
    const target = users[idx];
    if (!target) return;

    if (target.role === 'admin') {
      setUsersError('No puedes eliminar al usuario administrador.');
      return;
    }

    if (!window.confirm(`¿Eliminar usuario ${target.username}?`)) return;

    try {
      const data = await api(`/api/users/${encodeURIComponent(target.username)}`, { method: 'DELETE' });
      const freshUsers = Array.isArray(data.users) ? data.users.map(normalizeUser).filter(Boolean) : [];
      setUsersCache(freshUsers);
      if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
      if (typeof window.resetUserForm === 'function') window.resetUserForm();
      log('Usuario eliminado.', 'info');
    } catch (e) {
      setUsersError(e.message || 'No se pudo eliminar el usuario.');
    }
  };

  window.submitPasswordChange = async function () {
    const currentPass = (document.getElementById('changePassCurrent')?.value || '').trim();
    const newPass = (document.getElementById('changePassNew')?.value || '').trim();
    const confirmPass = (document.getElementById('changePassConfirm')?.value || '').trim();
    const err = document.getElementById('changePassError');

    const setErr = (msg) => {
      if (!err) return;
      if (!msg) {
        err.classList.add('hidden');
        err.innerText = '';
      } else {
        err.classList.remove('hidden');
        err.innerText = msg;
      }
    };

    if (!currentPass || !newPass || !confirmPass) {
      setErr('Completa los 3 campos.');
      return;
    }
    if (newPass.length < 6) {
      setErr('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPass !== confirmPass) {
      setErr('La confirmación no coincide.');
      return;
    }

    try {
      await api('/api/users/change-password', {
        method: 'POST',
        body: { currentPass, newPass }
      });
      setErr('');
      if (typeof window.toggleModal === 'function') window.toggleModal('changePasswordModal');
      log('Contraseña actualizada correctamente.', 'info');
    } catch (e) {
      setErr(e.message || 'No se pudo actualizar la contraseña.');
    }
  };

  window.downloadSecureUsersBackup = function () {
    setUsersError('En modo backend, los usuarios se respaldan en servidor. Usa respaldo de base de datos.');
  };

  window.openUsersBackupImport = function () {
    setUsersError('En modo backend, la importación local está deshabilitada.');
  };

  // Sincronizar estado inicial por si el backend cambió entre cargas.
  refreshBootstrap().catch(() => {
    // no-op
  });
})();
