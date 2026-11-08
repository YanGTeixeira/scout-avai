import { el, fmtDate } from './util.js';
import { bars, scatter } from './charts.js';
import { GROUPS, ORDER } from './metrics.js';
import { widgetSection } from './widgets.js';

const REL = { high: 'alta', medium: 'média', unverified: 'não verificada' };
const team = (n) => el('span', { class: n === 'Avaí' ? 'me' : null }, n);
const table = (pairs) => el('table', {}, el('tbody', {}, ...pairs.map((r) => el('tr', {}, ...r.map((c, i) => el('td', { class: i ? 'n' : null }, c))))));

function jogos(ms) {
  if (!ms.length) return el('p', { class: 'dim' }, 'Nenhuma partida cadastrada.');
  const hm = (m) => (m.kickoffAt ? new Date(m.kickoffAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : 'Agendado');
  return el('table', {}, el('tbody', {}, ...ms.map((m) => {
    let r = el('span', { class: 'dim' }, hm(m));
    if (m.status === 'finished' && m.score) {
      const a = m.avaiHome ? m.score.home : m.score.away, b = m.avaiHome ? m.score.away : m.score.home;
      r = el('span', {}, `${m.score.home} x ${m.score.away}`, el('span', { class: 'res ' + (a > b ? 'w' : a < b ? 'l' : 'd') }, a > b ? 'Vitória' : a < b ? 'Derrota' : 'Empate'));
    }
    return el('tr', {}, el('td', {}, `Rodada ${m.round}`), el('td', {}, fmtDate(m.date)), el('td', {}, team(m.home), ' x ', team(m.away)), el('td', { class: 'n' }, r));
  })));
}

export function painel(all, state, open) {
  const w = all.filter((p) => p.official);
  const top = (k) => w.filter((p) => p[k] > 0).sort((a, b) => b[k] - a[k] || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 8);
  const rank = (title, k) => { const t = top(k); return el('section', { class: 'block' }, el('h2', {}, title), t.length ? bars(t.map((p) => ({ label: p.name, value: p[k] }))) : el('p', { class: 'dim' }, 'Sem registros.')); };
  const cards = w.filter((p) => p.yellow > 0 || p.red > 0).sort((a, b) => b.yellow + b.red * 2 - (a.yellow + a.red * 2)).slice(0, 8);
  const sum = (k) => w.reduce((s, p) => s + (p[k] || 0), 0);
  const n = (f) => all.filter(f).length, of = (v) => `${v} de ${all.length}`;
  const pts = w.filter((p) => p.apps > 0).map((p) => ({ x: p.apps, y: (p.goals || 0) + (p.assists || 0), label: p.shirt ?? '', name: p.name, group: p.group, ref: p }));
  return el('div', { class: 'stack' },
    el('section', { class: 'block' }, el('h2', {}, 'Calendário'), jogos(state.matches || [])),
    el('div', { class: 'block' }, widgetSection(state, 'competition', 'comp-serie-b', { heading: 'Série B no SofaScore', level: 'h2' })),
    el('section', { class: 'block' }, el('h2', {}, 'Quem participa de gols'),
      el('p', { class: 'meta' }, 'Cada marcador é um atleta, com o número da camisa. Gols mais assistências, por jogos disputados. Clique para abrir a ficha.'),
      pts.length ? scatter(pts, { xl: 'Jogos', yl: 'Gols + assistências', pick: open }) : el('p', { class: 'dim' }, 'Sem estatísticas carregadas.'),
      el('p', { class: 'legend' }, ...ORDER.map((g) => el('span', { class: 'g-' + g }, el('i', { class: 'sw' }), GROUPS[g])))),
    el('div', { class: 'cols' }, rank('Artilharia', 'goals'), rank('Assistências', 'assists'),
      el('section', { class: 'block' }, el('h2', {}, 'Cartões'), cards.length ? bars(cards.map((p) => ({ label: p.name, value: p.yellow + p.red, parts: [{ v: p.yellow, c: 'y' }, { v: p.red, c: 'r' }] }))) : el('p', { class: 'dim' }, 'Sem registros.'),
        el('p', { class: 'legend' }, el('span', {}, el('i', { class: 'sw y' }), 'Amarelos'), el('span', {}, el('i', { class: 'sw r' }), 'Vermelhos'))),
      el('section', { class: 'block' }, el('h2', {}, 'Elenco por posição'), bars(ORDER.map((g) => ({ label: GROUPS[g], value: all.filter((p) => p.group === g).length }))))),
    el('div', { class: 'cols' },
      el('section', { class: 'block' }, el('h2', {}, 'Elenco em números'), table([['Atletas', all.length], ['Com estatísticas na fonte', w.length], ['Gols', sum('goals')], ['Assistências', sum('assists')], ['Amarelos', sum('yellow')], ['Vermelhos', sum('red')]])),
      el('section', { class: 'block' }, el('h2', {}, 'Completude do cadastro'), table([['Data de nascimento', of(n((p) => p.birth))], ['Altura', of(n((p) => p.height))], ['Pé dominante', of(n((p) => p.foot && p.foot !== 'Não informado'))], ['Vínculo com a fonte a conferir', n((p) => p.review)]]),
        el('p', { class: 'meta' }, 'Contratos, relatórios e partidas por atleta ainda não foram carregados.')),
      el('section', { class: 'block' }, el('h2', {}, 'Fontes'), table((state.sources || []).map((s) => [s.name, `confiabilidade ${REL[s.reliability] || s.reliability}`])))));
}
