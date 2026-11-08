// Única camada que fala com o servidor. Trocar de backend = mexer só aqui.
export async function loadState() {
  const r = await fetch('/api/state');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function call(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Falha ao salvar (HTTP ' + r.status + ').');
  return data;
}

export const newId = (p = 'id') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// kind: players | market | reports | history
export const saveItem = (kind, id, body) => call('PUT', `/api/${kind}/${encodeURIComponent(id)}`, body);
export const deleteItem = (kind, id) => call('DELETE', `/api/${kind}/${encodeURIComponent(id)}`);
export const saveTactical = (body) => call('PUT', '/api/tactical', body);
export const saveRoles = (roles) => call('PUT', '/api/roles', roles);
export const saveWidget = async (id, body) => (await call('PUT', '/api/widgets/' + encodeURIComponent(id), body)).widget;
export const deleteWidget = (id) => call('DELETE', '/api/widgets/' + encodeURIComponent(id));
