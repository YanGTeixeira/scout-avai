import { el, fmtN } from './util.js';
import { STATS, RATES } from './metrics.js';

export function comparador(all, cmp) {
  const w = all.filter((p) => p.official).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const body = el('div');
  const pick = (key, label) => el('select', { 'aria-label': label, onchange: (e) => { cmp[key] = e.target.value; paint(); } },
    el('option', { value: '' }, label), ...w.map((p) => el('option', { value: p.id, selected: cmp[key] === p.id }, p.name + (p.shirt != null ? ` (${p.shirt})` : ''))));
  function paint() {
    const a = w.find((p) => p.id === cmp.a), b = w.find((p) => p.id === cmp.b);
    if (!a || !b) return body.replaceChildren(el('p', { class: 'state' }, 'Escolha dois atletas para comparar. Só aparecem atletas com estatísticas na fonte.'));
    const rows = [...STATS, ...RATES].map((m) => ({ m, x: m.f(a.official), y: m.f(b.official) })).filter((r) => r.x != null || r.y != null);
    body.replaceChildren(
      el('div', { class: 'crow head' }, el('b', { class: 'ha' }, a.name), el('b', { class: 'hb' }, b.name)),
      ...rows.map(({ m, x, y }) => {
        const max = Math.max(x ?? 0, y ?? 0) || 1;
        const lead = m.neutral || x === y ? 0 : (x ?? -1) > (y ?? -1) ? 1 : 2;
        const side = (v, n) => [fmtN(v, m.d), lead === n ? 'lead' : null, `${((v ?? 0) / max) * 100}%`];
        const [xa, la, wa] = side(x, 1), [yb, lb, wb] = side(y, 2);
        return el('div', { class: 'crow' }, el('b', { class: la }, xa), el('span', { class: 'ca' }, el('i', { class: la, style: `width:${wa}` })),
          el('span', { class: 'cl' }, m.l), el('span', { class: 'cb' }, el('i', { class: lb, style: `width:${wb}` })), el('b', { class: lb }, yb));
      }),
      el('p', { class: 'meta' }, (a.group !== b.group ? 'Posições diferentes: compare com cautela. ' : '') + 'A fonte não traz minutos jogados; as taxas usam jogos, não 90 minutos. Em cartões, faltas cometidas e gols sofridos não há destaque, porque menos nem sempre é melhor.'));
  }
  paint();
  return el('div', {}, el('div', { class: 'toolbar' }, pick('a', 'Atleta A'), pick('b', 'Atleta B')), body);
}
