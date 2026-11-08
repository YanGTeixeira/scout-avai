import { el, sv } from './util.js';
import { tip } from './ui.js';

// Barras horizontais em HTML (acessíveis). parts empilha séries (ex.: titular + reserva) com 2px de respiro.
export function bars(items, max = Math.max(...items.map((i) => i.value), 1)) {
  return el('ol', { class: 'bars' }, ...items.map((i) => {
    const li = el('li', {},
      el('span', { class: 'bl', title: i.label }, i.label),
      el('span', { class: 'bt' }, ...(i.parts || [{ v: i.value, c: '' }]).filter((p) => p.v > 0).map((p) => el('i', { class: p.c || null, style: `width:${(p.v / max) * 100}%` }))),
      el('b', {}, i.display != null ? i.display : String(i.value)));
    if (i.tip) { li.tabIndex = 0; tip(li, i.tip); }
    return li;
  }));
}

export const legend = (items) => el('p', { class: 'legend' }, ...items.map(([cls, label]) => el('span', {}, el('i', { class: 'sw ' + cls }), label)));

const keyAct = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

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
    const cx = X(p.x) + k * 21, cy = Y(p.y);
    const go = () => pick(p.ref);
    const text = `${p.name}: ${p.x} jogos, ${p.y} participações em gol`;
    svg.append(tip(sv('g', { class: `dot g-${p.group}`, tabindex: 0, role: 'button', 'aria-label': text, onclick: go, onkeydown: keyAct(go) },
      sv('circle', { cx, cy, r: 10 }), sv('text', { x: cx, y: cy + 3.5, 'text-anchor': 'middle' }, String(p.label))), text));
  }
  return svg;
}

// Faixas por linha: cada linha é um grupo (ex.: posição), cada ponto um atleta ao longo de x (idade, altura...).
// rows: [{ label, pts: [{ x, label, on, text, ref }] }]. zone: { from, to, label } destaca um intervalo.
export function stripChart(rows, { min, max, step, xl, zone, pick }) {
  const W = 760, L = 112, R = 20, T = zone ? 26 : 10, RH = 66, B = 34;
  const H = T + rows.length * RH + B;
  const X = (v) => L + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (W - L - R);
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'group', 'aria-label': xl });
  if (zone) svg.append(sv('rect', { x: X(zone.from), y: T - 4, width: X(zone.to) - X(zone.from), height: rows.length * RH + 4, class: 'zone' }),
    sv('text', { x: (X(zone.from) + X(zone.to)) / 2, y: T - 10, class: 'zonel', 'text-anchor': 'middle' }, zone.label));
  for (let v = min; v <= max; v += step) svg.append(sv('line', { x1: X(v), x2: X(v), y1: T, y2: T + rows.length * RH, class: 'gl' }),
    sv('text', { x: X(v), y: T + rows.length * RH + 16, class: 'ax', 'text-anchor': 'middle' }, String(v)));
  svg.append(sv('text', { x: W - R, y: H - 4, class: 'ax', 'text-anchor': 'end' }, xl));
  rows.forEach((r, i) => {
    const cy = T + i * RH + RH / 2;
    svg.append(sv('line', { x1: L, x2: W - R, y1: T + (i + 1) * RH, y2: T + (i + 1) * RH, class: 'base' }),
      sv('text', { x: L - 12, y: cy + 4, class: 'rowl', 'text-anchor': 'end' }, r.label));
    const placed = [];
    [...r.pts].sort((a, b) => a.x - b.x).forEach((p) => {
      const cx = X(p.x);
      let dy = 0;
      for (const cand of [0, -20, 20, -40, 40]) { dy = cand; if (!placed.some((q) => Math.abs(q.x - cx) < 21 && q.dy === cand)) break; }
      placed.push({ x: cx, dy });
      const y = cy + dy, go = () => pick && pick(p.ref);
      svg.append(tip(sv('g', { class: 'pt' + (p.on ? '' : ' off'), tabindex: 0, role: 'button', 'aria-label': p.text, onclick: go, onkeydown: keyAct(go) },
        sv('circle', { cx, cy: y, r: 10 }), sv('text', { x: cx, y: y + 3.5, 'text-anchor': 'middle' }, String(p.label == null ? '' : p.label))), p.text));
    });
  });
  return el('div', { class: 'scroll-x' }, svg);
}
