// Drop-in replacement for src/api/base44Client.js — repoints the React app from Base44
// to the self-hosted Nexus backend. Exports the same `base44` object with the same
// surface the app already uses (entities, auth, functions, integrations), so the
// 1,400+ existing call sites keep working unchanged.
//
// Install: back up the old file, then copy this over src/api/base44Client.js.
// Configure: set VITE_NEXUS_API_URL in your frontend env (e.g. https://api.yourdomain.com).

const API = (import.meta.env?.VITE_NEXUS_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'nexus_token';

const getToken = () => (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
const setToken = (t) => { if (typeof localStorage !== 'undefined') { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } };

async function api(path, { method = 'POST', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { /* let callers handle via redirectToLogin */ }
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

// ---- entities: base44.entities.<Name>.<op>(...) ----
const entities = new Proxy({}, {
  get(_t, name) {
    const base = `/entities/${String(name)}`;
    return {
      filter: (query = {}, sort, limit) => api(`${base}/filter`, { body: { query, sort, limit } }),
      list: (sort, limit) => api(`${base}/list`, { body: { sort, limit } }),
      get: (id) => api(`${base}/get`, { body: { id } }),
      create: (data) => api(`${base}/create`, { body: { data } }),
      update: (id, data) => api(`${base}/update`, { body: { id, data } }),
      delete: (id) => api(`${base}/delete`, { body: { id } }),
      bulkCreate: (docs) => api(`${base}/bulkCreate`, { body: { docs } }),
      // Realtime .subscribe() → polling fallback (Base44 used websockets; Phase 3 can add SSE).
      subscribe: (arg1, arg2) => {
        const query = typeof arg1 === 'function' ? {} : (arg1 || {});
        const cb = typeof arg1 === 'function' ? arg1 : arg2;
        const intervalMs = Number(import.meta.env?.VITE_NEXUS_POLL_MS || 8000);
        let stop = false;
        const tick = async () => { if (stop) return; try { cb?.(await api(`${base}/filter`, { body: { query } })); } catch { /* ignore */ } };
        tick();
        const h = setInterval(tick, intervalMs);
        return () => { stop = true; clearInterval(h); };
      },
    };
  },
});

// ---- auth: base44.auth.<op>(...) ----
const auth = {
  async me() {
    const r = await api('/auth/me', { method: 'GET' });
    return r;
  },
  async updateMe(data) { return api('/auth/updateMe', { body: data }); },
  async login(email, password) { const r = await api('/auth/login', { body: { email, password } }); setToken(r.token); return r.user; },
  async signup(email, password, full_name) { const r = await api('/auth/signup', { body: { email, password, full_name } }); setToken(r.token); return r.user; },
  logout() { setToken(null); if (typeof window !== 'undefined') window.location.href = (import.meta.env?.VITE_LOGIN_URL || '/login'); },
  redirectToLogin(returnUrl) {
    if (typeof window !== 'undefined') {
      const url = import.meta.env?.VITE_LOGIN_URL || '/login';
      const back = returnUrl || window.location.href;
      window.location.href = `${url}?redirect=${encodeURIComponent(back)}`;
    }
  },
  async isAuthenticated() { try { await auth.me(); return true; } catch { return false; } },
  setToken, getToken,
};

// ---- functions: base44.functions.invoke(name, payload) ----
const functions = {
  async invoke(name, payload = {}) { return api(`/functions/${name}`, { body: payload }); },
};

// ---- integrations: base44.integrations.Core.<op>(...) ----
const Core = {
  async InvokeLLM(args) { const r = await api('/integrations/InvokeLLM', { body: args }); return r?.result ?? r; },
  async SendEmail(args) { return api('/integrations/SendEmail', { body: args }); },
  async GenerateImage(args) { return api('/integrations/GenerateImage', { body: args }); },
  async GenerateSpeech(args) { return api('/integrations/GenerateSpeech', { body: args }); },
  async UploadFile(args) { return api('/integrations/UploadFile', { body: args }); },
};

export const base44 = { entities, auth, functions, integrations: { Core } };
export default base44;
