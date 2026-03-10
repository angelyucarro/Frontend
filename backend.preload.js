(function () {
  'use strict';

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

  function writeBootstrap(data) {
    const me = data && data.me ? normalizeUser(data.me) : null;
    let users = Array.isArray(data && data.users) ? data.users.map(normalizeUser).filter(Boolean) : [];

    if (me && !users.some(u => u.username === me.username)) {
      users = [me, ...users];
    }

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));

    if (me && me.username) localStorage.setItem(CURRENT_USER_KEY, me.username);
    else localStorage.removeItem(CURRENT_USER_KEY);

    const links = (data && data.links && typeof data.links === 'object') ? data.links : {};
    Object.entries(LINK_MAP).forEach(([apiKey, lsKey]) => {
      if (typeof links[apiKey] === 'string' && links[apiKey].trim()) {
        localStorage.setItem(lsKey, links[apiKey].trim());
      }
    });
  }

  function syncBootstrapSync() {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/bootstrap', false);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();
      if (xhr.status >= 200 && xhr.status < 300) {
        const payload = JSON.parse(xhr.responseText || '{}');
        writeBootstrap(payload);
        window.__BACKEND_BOOTSTRAP__ = payload;
      }
    } catch (_) {
      // Si falla backend, se mantiene comportamiento local existente.
    }
  }

  window.YUCARRO_AUTH = {};
  window.__BACKEND_MODE__ = true;
  syncBootstrapSync();
})();
