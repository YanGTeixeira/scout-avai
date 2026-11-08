'use strict';
// Cliente HTTP dos coletores: identificação honesta, timeout e poucas tentativas com espera crescente.
// Não tenta contornar bloqueios: 401/403/404 encerram na primeira resposta.

const USER_AGENT = 'scout-avai-collector/1.0 (+https://github.com/YanGTeixeira/scout-avai)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { timeoutMs = 20000, retries = 2, fetchImpl = fetch } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: ctrl.signal });
      if (res.ok) return { status: res.status, headers: res.headers, body: await res.json() };
      const err = new Error(`HTTP ${res.status} em ${url}`);
      err.status = res.status;
      if (res.status !== 429 && res.status < 500) throw err; // erro definitivo: não repete
      lastErr = err;
    } catch (e) {
      if (e.status && e.status !== 429 && e.status < 500) throw e;
      lastErr = e.name === 'AbortError' ? new Error(`Tempo esgotado em ${url}`) : e;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw lastErr;
}

module.exports = { fetchJson, USER_AGENT };
