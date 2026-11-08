'use strict';
// Cliente do Ollama (IA local). API: https://github.com/ollama/ollama/blob/main/docs/api.md
// O modelo roda na máquina do usuário; nada sai da rede local.

const BASE = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 8192; // o contexto do elenco ocupa ~2–3 mil tokens

async function status({ fetchImpl = fetch } = {}) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetchImpl(`${BASE}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { online: false, url: BASE, model: MODEL, error: `Ollama respondeu HTTP ${r.status}.` };
    const models = ((await r.json()).models || []).map((m) => m.name);
    const has = models.some((n) => n === MODEL || n === MODEL + ':latest' || n.split(':')[0] === MODEL);
    return { online: true, url: BASE, model: MODEL, models, modelInstalled: has };
  } catch (e) {
    return { online: false, url: BASE, model: MODEL, error: 'Ollama não está rodando nesse endereço.' };
  }
}

// Gera a resposta em pedaços (streaming NDJSON do Ollama).
async function* chat(messages, { fetchImpl = fetch, model = MODEL, signal } = {}) {
  const r = await fetchImpl(`${BASE}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ model, messages, stream: true, options: { temperature: 0.4, num_ctx: NUM_CTX } }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Ollama respondeu HTTP ${r.status}${txt ? ': ' + txt.slice(0, 200) : ''}`);
  }
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of r.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.error) throw new Error(ev.error);
      if (ev.message && ev.message.content) yield ev.message.content;
      if (ev.done) return;
    }
  }
}

module.exports = { status, chat, MODEL, BASE };
