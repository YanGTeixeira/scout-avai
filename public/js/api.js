// Única camada que fala com o servidor. Trocar de backend = mexer só aqui.
export async function loadState() {
  const r = await fetch('/api/state');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
