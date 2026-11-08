import { el, age, AGE_BANDS, ageBand, ufOf, mean, fmtN, fmtDate } from './util.js';
import { bars, legend, stripChart } from './charts.js';
import { tip } from './ui.js';
import { GROUPS, ORDER } from './metrics.js';

// Perfil do elenco profissional: profundidade por posição, estrutura etária, utilização, origem e físico.
// Jogos e titularidade vêm da ESPN (sem minutos); idade, altura, peso e naturalidade, do site do clube.
const LINES = [['GK'], ['CB', 'FB'], ['DM'], ['MF'], ['FW']];

const stat = (k, v, unit, note) => el('div', { class: 'stat' }, el('span', { class: 'k' }, k),
  el('span', { class: 'v' }, v, unit ? el('small', {}, unit) : null), note ? el('span', { class: 'n' }, note) : null);

const panel = (title, meta, ...body) => el('section', { class: 'panel' }, el('h2', {}, title), meta ? el('p', { class: 'meta' }, meta) : null, ...body);

export function perfil({ all, state, open }) {
  const P = all.map((p) => {
    const o = p.official || {};
    return { ...p, age: age(p.birth), apps: o.appearances || 0, starts: o.startsDerived || 0, subs: o.substituteAppearances || 0 };
  });
  const withAge = P.filter((p) => p.age != null);
  const played = P.filter((p) => p.apps > 0);
  const appsTotal = played.reduce((s, p) => s + p.apps, 0);
  const weighted = appsTotal ? played.filter((p) => p.age != null).reduce((s, p) => s + p.age * p.apps, 0) / played.filter((p) => p.age != null).reduce((s, p) => s + p.apps, 0) : null;
  const heights = P.map((p) => Number(p.height) || null).filter(Boolean);
  const sc = P.filter((p) => ufOf(p.birthPlace) === 'SC').length;
  const asOf = P.find((p) => p.asOf)?.asOf;

  const board = el('div', { class: 'scoreboard' },
    stat('Idade média', withAge.length ? fmtN(mean(withAge.map((p) => p.age)), 1) : '—', ' anos', `${withAge.length} de ${P.length} com data de nascimento`),
    stat('Idade média em campo', weighted != null ? fmtN(weighted, 1) : '—', ' anos', 'Ponderada pelos jogos na Série B'),
    stat('Atletas utilizados', String(played.length), ` de ${P.length}`, 'Com ao menos um jogo na Série B'),
    stat('Até 21 anos', String(withAge.filter((p) => p.age <= 21).length), null, `${withAge.filter((p) => p.age <= 21 && p.apps > 0).length} já jogaram`),
    stat('Altura média', heights.length ? fmtN(mean(heights), 0) : '—', ' cm', `Naturais de SC: ${sc}`));

  // Prancheta: cada posição em sua faixa do campo, atletas por ordem de uso (titularidade, depois jogos).
  const maxApps = Math.max(1, ...P.map((p) => p.apps));
  const slot = (g) => {
    const ps = P.filter((p) => p.group === g).sort((a, b) => b.starts - a.starts || b.apps - a.apps || (a.shirt ?? 999) - (b.shirt ?? 999));
    const ages = ps.map((p) => p.age).filter((a) => a != null);
    return el('section', { class: `slot g-${g}` },
      el('h3', {}, GROUPS[g], el('small', {}, `${ps.length} atl.${ages.length ? `, média ${fmtN(mean(ages), 1)} anos` : ''}`)),
      ps.length ? el('ol', {}, ...ps.map((p) => {
        const text = `${p.name}${p.age != null ? `, ${p.age} anos` : ''}: ${p.apps} jogos, ${p.starts} como titular`;
        return el('li', { class: p.apps ? null : 'bench' },
          el('span', { class: 'num' }, p.shirt != null ? String(p.shirt) : '–'),
          el('button', { onclick: () => open(p), title: text }, p.name),
          el('span', { class: 'age' }, p.age != null ? `${p.age}a` : '—'),
          tip(el('span', { class: 'use', tabindex: '-1' }, el('i', { style: `width:${(p.apps / maxApps) * 100}%` })), text));
      })) : el('p', { class: 'dim', style: 'padding:0 12px 8px;margin:0' }, 'Sem atletas.'));
  };
  const pitch = el('div', { class: 'pitch', role: 'group', 'aria-label': 'Profundidade do elenco por posição' },
    el('span', { class: 'half' }), el('span', { class: 'box left' }), el('span', { class: 'box right' }),
    ...LINES.map((ln) => el('div', { class: 'line' }, ...ln.map(slot))));

  // Idade por posição
  const ageRows = ORDER.map((g) => ({ label: GROUPS[g], pts: P.filter((p) => p.group === g && p.age != null).map((p) => ({
    x: p.age, label: p.shirt, on: p.apps > 0, ref: p,
    text: `${p.name}, ${p.age} anos: ${p.apps ? `${p.apps} jogos (${p.starts} como titular)` : 'sem jogos na Série B'}` })) }));
  const ages = withAge.map((p) => p.age);
  const ageMin = Math.max(14, Math.floor((Math.min(...ages, 18) - 1) / 2) * 2), ageMax = Math.ceil((Math.max(...ages, 36) + 1) / 2) * 2;

  // Faixas etárias por posição
  const bandBars = ORDER.map((g) => {
    const ps = withAge.filter((p) => p.group === g);
    const parts = AGE_BANDS.map((b) => ({ v: ps.filter((p) => ageBand(p.age) === b).length, c: b.k }));
    return { label: GROUPS[g], value: ps.length, parts, tip: `${GROUPS[g]}: ` + AGE_BANDS.map((b, i) => `${b.l}: ${parts[i].v}`).join('; ') };
  });

  // Utilização
  const used = [...played].sort((a, b) => b.apps - a.apps || b.starts - a.starts);
  const unused = P.filter((p) => !p.apps);
  const useBars = used.map((p) => ({ label: `${p.shirt != null ? p.shirt + ' ' : ''}${p.name}`, value: p.apps, parts: [{ v: p.starts, c: 's1' }, { v: p.subs, c: 's2' }],
    tip: `${p.name}: ${p.apps} jogos, ${p.starts} como titular, ${p.subs} saindo do banco` }));

  // Origem
  const ufs = {};
  P.forEach((p) => { const u = ufOf(p.birthPlace) || (p.birthPlace ? 'Sem UF' : 'Não informado'); ufs[u] = (ufs[u] || 0) + 1; });
  const ufBars = Object.entries(ufs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([u, v]) => ({ label: u, value: v, tip: `${u}: ${v} atleta${v > 1 ? 's' : ''}` }));
  const ufNote = ufs['Sem UF'] ? ' "Sem UF": o clube informou só a cidade.' : '';

  // Altura por posição
  const hRows = ORDER.map((g) => ({ label: GROUPS[g], pts: P.filter((p) => p.group === g && Number(p.height)).map((p) => ({
    x: Number(p.height), label: p.shirt, on: true, ref: p, text: `${p.name}: ${p.height} cm${p.weight ? `, ${p.weight} kg` : ''}` })) }));
  const hs = heights.length ? heights : [170, 190];

  return el('div', { class: 'stack' },
    board,
    panel('Profundidade por posição', `Atletas ordenados por jogos como titular e depois por jogos na Série B 2026. A barra sob cada nome mostra os jogos em relação ao mais utilizado do elenco. Nome em cinza: sem jogos.${asOf ? ` Jogos até ${fmtDate(asOf)} (ESPN).` : ''}`, pitch),
    panel('Idade por posição', 'Cada marcador é um atleta, com o número da camisa. A faixa destacada vai de 24 a 29 anos.',
      stripChart(ageRows, { min: ageMin, max: ageMax, step: 2, xl: 'Idade (anos)', zone: { from: 24, to: 29, label: '24 a 29 anos' }, pick: open }),
      legend([['fill', 'Jogou na Série B 2026'], ['ring', 'Sem jogos na Série B 2026']])),
    el('div', { class: 'cols wide' },
      panel('Faixas etárias por posição', 'Quantos atletas de cada idade há em cada posição.',
        bars(bandBars), legend(AGE_BANDS.map((b) => [b.k, b.l]))),
      panel('Origem dos atletas', 'Estado de nascimento informado pelo clube.' + ufNote, bars(ufBars))),
    panel('Utilização na Série B 2026', `Jogos por atleta, divididos entre titular e reserva que entrou. A fonte não publica minutos.${unused.length ? ` Sem jogos: ${unused.map((p) => p.name).join(', ')}.` : ''}`,
      useBars.length ? bars(useBars) : el('p', { class: 'dim' }, 'Sem estatísticas carregadas.'),
      legend([['s1', 'Como titular'], ['s2', 'Saindo do banco']])),
    panel('Altura por posição', 'Altura informada pelo clube, em centímetros.',
      stripChart(hRows, { min: Math.floor((Math.min(...hs) - 2) / 5) * 5, max: Math.ceil((Math.max(...hs) + 2) / 5) * 5, step: 5, xl: 'Altura (cm)', pick: open })));
}
