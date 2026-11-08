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
