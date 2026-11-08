import { el, sv } from './util.js';

// Barras horizontais em HTML (acessíveis). parts permite empilhar (ex.: amarelos e vermelhos).
export function bars(items, max = Math.max(...items.map((i) => i.value), 1)) {
  return el('ol', { class: 'bars' }, ...items.map((i) => el('li', {},
    el('span', { class: 'bl' }, i.label),
    el('span', { class: 'bt' }, ...(i.parts || [{ v: i.value, c: '' }]).map((p) => el('i', { class: p.c || null, style: `width:${(p.v / max) * 100}%` }))),
    el('b', {}, String(i.value)))));
}

// Dispersão: x e y numéricos, marcador com o número da camisa.
export function scatter(pts, { xl, yl, pick }) {
  const W = 640, H = 340, L = 44, B = 40, T = 12, R = 16;
  const xm = Math.max(5, Math.ceil(Math.max(...pts.map((p) => p.x)) / 5) * 5);
  const ym = Math.max(2, Math.ceil(Math.max(...pts.map((p) => p.y)) / 2) * 2);
  const X = (v) => L + (v / xm) * (W - L - R), Y = (v) => H - B - (v / ym) * (H - B - T);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scatter', role: 'group', 'aria-label': `${yl} por ${xl}` });
  const ys = Math.ceil(ym / 5);
  for (let v = 0; v <= ym; v += ys) svg.append(sv('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'gl' }), sv('text', { x: L - 8, y: Y(v) + 4, class: 'ax', 'text-anchor': 'end' }, String(v)));
  for (let v = 0; v <= xm; v += 5) svg.append(sv('text', { x: X(v), y: H - B + 18, class: 'ax', 'text-anchor': 'middle' }, String(v)));
  svg.append(sv('text', { x: W - R, y: H - 6, class: 'ax', 'text-anchor': 'end' }, xl), sv('text', { x: L + 6, y: T + 10, class: 'ax' }, yl));
  const seen = {};
  for (const p of pts) {
    const key = p.x + ',' + p.y, k = (seen[key] = (seen[key] || 0) + 1) - 1;
    const cx = X(p.x) + k * 15, cy = Y(p.y);
    const go = () => pick(p.ref);
    svg.append(sv('g', { class: `dot g-${p.group}`, tabindex: 0, role: 'button', 'aria-label': `${p.name}: ${p.x} jogos, ${p.y} participações em gol`, onclick: go,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } },
      sv('title', {}, `${p.name}: ${p.x} jogos, ${p.y} participações em gol`), sv('circle', { cx, cy, r: 11 }), sv('text', { x: cx, y: cy + 4, 'text-anchor': 'middle' }, String(p.label))));
  }
  return svg;
}
