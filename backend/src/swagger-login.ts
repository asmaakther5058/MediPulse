// Swagger UI helpers (browser-side code, injected by main.ts).
// 1. After a successful POST /auth/login, the returned token is put into
//    Authorize automatically.
// 2. A bar at the top of /api/docs shows who is logged in (role, name, email)
//    and when the token expires.

// Runs in the browser inside Swagger UI, so it must not use anything from
// this file's scope. Swagger serialises it with fn.toString().
export function autoAuthorizeOnLogin(res: {
  url: string;
  ok: boolean;
  body?: { accessToken?: string; user?: { fullName?: string; email?: string } };
}) {
  try {
    if (
      res.ok &&
      /\/auth\/login(\?|$)/.test(res.url) &&
      res.body?.accessToken
    ) {
      const w = window as unknown as {
        ui: { authActions: { authorize: (auth: object) => void } };
      };
      const auth = {
        bearer: {
          name: 'bearer',
          schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          value: res.body.accessToken,
        },
      };
      w.ui.authActions.authorize(auth);
      // Saved the same way the Authorize dialog saves it, so a page reload keeps it
      localStorage.setItem('authorized', JSON.stringify(auth));
      localStorage.setItem(
        'mp_user',
        JSON.stringify({
          email: res.body.user?.email,
          fullName: res.body.user?.fullName,
        }),
      );
    }
  } catch {
    // never break the response shown in Swagger
  }
  return res;
}

export const LOGIN_BAR_JS = `
(function () {
  var COLORS = { PATIENT: '#1f8a4c', DOCTOR: '#1f5f8a', DIAGNOSTIC_CENTER: '#8a5a1f', ADMIN: '#8a1f3d' };
  var bar = document.createElement('div');
  bar.id = 'mp-login-bar';
  bar.style.cssText = 'position:sticky;top:0;z-index:1000;padding:8px 20px;font:14px sans-serif;color:#fff;display:flex;gap:12px;align-items:center;';
  document.body.insertBefore(bar, document.body.firstChild);

  function readToken() {
    try {
      var auth = window.ui && window.ui.authSelectors.authorized().toJS();
      if (auth && auth.bearer && auth.bearer.value) return auth.bearer.value;
    } catch (e) {}
    try {
      var saved = JSON.parse(localStorage.getItem('authorized') || '{}');
      return saved.bearer && saved.bearer.value;
    } catch (e) { return null; }
  }

  function decode(token) {
    try {
      var part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(part))));
    } catch (e) { return null; }
  }

  function render() {
    var token = readToken();
    var p = token && decode(token);
    if (!p) {
      bar.style.background = '#555';
      bar.textContent = 'Not logged in. Call POST /auth/login and the token is set automatically.';
      return;
    }
    var expired = p.exp && p.exp * 1000 < Date.now();
    var name = '';
    try {
      var u = JSON.parse(localStorage.getItem('mp_user') || '{}');
      if (u.email === p.email) name = u.fullName || '';
    } catch (e) {}
    var until = p.exp ? new Date(p.exp * 1000).toLocaleTimeString() : '';
    bar.style.background = expired ? '#a33' : (COLORS[p.role] || '#333');
    bar.innerHTML = '';
    var badge = document.createElement('b');
    badge.textContent = (expired ? 'Token expired: ' : 'Logged in as ') + p.role;
    badge.style.cssText = 'background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px;';
    var who = document.createElement('span');
    who.textContent = (name ? name + ' · ' : '') + p.email + (until && !expired ? ' · token valid until ' + until : '');
    bar.appendChild(badge);
    bar.appendChild(who);
  }
  render();
  setInterval(render, 1000);
})();
`;
