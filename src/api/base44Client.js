// Self-hosted API client — replaces the Base44 SDK. Exposes the same `base44` object
// (entities, auth, functions, integrations) the app already uses, so no call sites change.
// Points at the Nexus backend via VITE_NEXUS_API_URL.
const API = (import.meta.env?.VITE_NEXUS_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'nexus_token';

const getToken = () => (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
const setToken = (t) => { if (typeof localStorage !== 'undefined') { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } };

async function api(path, { method = 'POST', body } = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
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
      // Realtime .subscribe() → polling fallback (Base44 used websockets).
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
  async me() { return api('/auth/me', { method: 'GET' }); },
  async updateMe(data) { return api('/auth/updateMe', { body: data }); },
  async login(email, password) { const r = await api('/auth/login', { body: { email, password } }); setToken(r.token); return r.user; },
  async signup(email, password, full_name) { const r = await api('/auth/signup', { body: { email, password, full_name } }); setToken(r.token); return r.user; },
  async requestPasswordReset(email) { return api('/auth/request-reset', { body: { email } }); },
  async resetPassword(email, token, new_password) { const r = await api('/auth/reset-password', { body: { email, token, new_password } }); if (r?.token) setToken(r.token); return r; },
  async googleLogin(idToken) { const r = await api('/auth/google', { body: { id_token: idToken } }); setToken(r.token); return r.user; },
  logout(_returnUrl) {
    setToken(null);
    if (typeof window !== 'undefined') window.location.href = (import.meta.env?.VITE_LOGIN_URL || '/login');
  },
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
// Base44 returned an axios-style response, so existing code reads `response.data.<field>`
// and relies on a throw for non-2xx. We reproduce that shape exactly for 1:1 compatibility.
const functions = {
  async invoke(name, payload = {}) {
    const headers = { 'content-type': 'application/json' };
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`${API}/functions/${name}`, { method: 'POST', headers, body: payload != null ? JSON.stringify(payload) : undefined });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      throw Object.assign(new Error((data && data.error) || `HTTP ${res.status}`),
        { status: res.status, data, response: { data, status: res.status } });
    }
    return { data, status: res.status };   // consumers read response.data.<field>
  },
};

// ---- integrations: base44.integrations.Core.<op>(...) ----
const Core = {
  async InvokeLLM(args) { const r = await api('/integrations/InvokeLLM', { body: args }); return r?.result ?? r; },
  async SendEmail(args) { return api('/integrations/SendEmail', { body: args }); },
  async GenerateImage(args) { return api('/integrations/GenerateImage', { body: args }); },
  async GenerateSpeech(args) { return api('/integrations/GenerateSpeech', { body: args }); },
  // Preserves Base44's one-call UploadFile({ file }) → { file_url }: requests a presigned
  // S3 URL from the backend, PUTs the bytes, and returns the public URL. Also accepts
  // { filename } to just get URLs.
  async UploadFile(args = {}) {
    const file = args.file;
    const filename = args.filename || file?.name || 'file.bin';
    const urls = await api('/integrations/UploadFile', { body: { filename } });
    if (file && urls?.upload_url) {
      await fetch(urls.upload_url, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
      return { file_url: urls.file_url };
    }
    return urls;
  },
};

// ---- analytics: base44.analytics.track(event) ----
const analytics = {
  async track(event) { try { return await api('/analytics', { body: { type: 'track', ...event } }); } catch { return { ok: false }; } },
  async page(props) { try { return await api('/analytics', { body: { type: 'page', ...props } }); } catch { return { ok: false }; } },
  async identify(props) { try { return await api('/analytics', { body: { type: 'identify', ...props } }); } catch { return { ok: false }; } },
};

// ---- agents: in-app AI agent conversations (persisted; assistant replies via the runtime) ----
const agents = {
  createConversation: ({ agent_name, metadata } = {}) => api('/agents/conversations', { body: { agent_name, metadata } }),
  addMessage: (conversation, message) => {
    const convId = conversation?.id || conversation;
    return api(`/agents/conversations/${convId}/messages`, { body: message });
  },
  getMessages: (convId) => api(`/agents/conversations/${convId}/messages`, { method: 'GET' }),
  listConversations: (agent_name) => api('/agents/conversations/list', { body: { agent_name } }),
  // WhatsApp/Telegram channels aren't wired in self-hosted — returns unavailable rather than crashing.
  async getWhatsAppConnectURL() { return { url: null, available: false }; },
  // Polling-based realtime (Base44 used websockets). Calls back with the message list.
  subscribeToConversation: (convId, cb) => {
    const intervalMs = Number(import.meta.env?.VITE_NEXUS_POLL_MS || 4000);
    let stop = false;
    const tick = async () => { if (stop) return; try { cb?.(await api(`/agents/conversations/${convId}/messages`, { method: 'GET' })); } catch { /* ignore */ } };
    tick();
    const h = setInterval(tick, intervalMs);
    return () => { stop = true; clearInterval(h); };
  },
};

// ---- users (admin) ----
const users = {
  inviteUser: (email, opts = {}) => api('/auth/invite', { body: { email, ...opts } }),
  list: (sort, limit) => api('/entities/User/list', { body: { sort, limit } }),
};

// ---- connectors: Base44 app-user connectors → graceful no-op in self-hosted ----
const connectors = {
  async connectAppUser() { return { connected: false, reason: 'connectors are not configured in the self-hosted build' }; },
};

// ---- appLogs: in-app user logging ----
const appLogs = {
  logUserInApp: (entry) => api('/applogs', { body: entry }).catch(() => ({ ok: false })),
};

// ---- asServiceRole: on the frontend this routes through the authenticated user's own
// permissions (the browser can't hold real service-role rights). Server-side RLS still applies. ----
const asServiceRole = { entities, integrations: { Core }, functions };

export const base44 = { entities, auth, functions, integrations: { Core }, analytics, agents, users, connectors, appLogs, asServiceRole };
export default base44;
