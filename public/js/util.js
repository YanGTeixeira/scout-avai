export const $ = (s) => document.querySelector(s);
const fill = (n, props, kids) => {
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...kids.filter((x) => x != null && x !== false));
  return n;
};
export const el = (t, p = {}, ...k) => fill(document.createElement(t), p, k);
export const sv = (t, p = {}, ...k) => fill(document.createElementNS('http://www.w3.org/2000/svg', t), p, k);
export const empty = (v) => v == null || v === '';
export const show = (v) => (empty(v) ? '—' : String(v));
export const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const fmtDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : iso || '');
export const fmtN = (v, d = 0) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
// Idade em anos completos na data de hoje (null se a data não for ISO completa).
export const age = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [y, m, d] = iso.split('-').map(Number), t = new Date();
  return t.getFullYear() - y - (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d) ? 1 : 0);
};
// Faixas etárias usadas no planejamento do elenco.
export const AGE_BANDS = [
  { k: 'a1', l: 'Até 21', test: (a) => a <= 21 },
  { k: 'a2', l: '22 a 25', test: (a) => a >= 22 && a <= 25 },
  { k: 'a3', l: '26 a 29', test: (a) => a >= 26 && a <= 29 },
  { k: 'a4', l: '30 ou mais', test: (a) => a >= 30 },
];
export const ageBand = (a) => (a == null ? null : AGE_BANDS.find((b) => b.test(a)));
// "Rio de Janeiro-RJ" | "Junqueirópolis_SP" -> "RJ" / "SP"; sem UF -> null
export const ufOf = (place) => { const m = String(place || '').trim().match(/[-_/]\s*([A-Za-z]{2})$/); return m ? m[1].toUpperCase() : null; };
export const mean = (xs) => { const v = xs.filter((x) => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
