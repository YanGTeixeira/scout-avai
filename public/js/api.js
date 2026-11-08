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

export const saveWidget = async (id, body) => (await call('PUT', '/api/widgets/' + encodeURIComponent(id), body)).widget;
export const deleteWidget = (id) => call('DELETE', '/api/widgets/' + encodeURIComponent(id));
