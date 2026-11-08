import { el, fmtDate, fmtN, age, mean } from './util.js';
import { bars, scatter, legend } from './charts.js';
import { GROUPS, ORDER } from './metrics.js';
import { widgetSection } from './widgets.js';

const team = (n) => el('span', { class: n === 'Avaí' ? 'me' : null }, n);
const table = (pairs) => el('table', {}, el('tbody', {}, ...pairs.map((r) => el('tr', {}, ...r.map((c, i) => el('td', { class: i ? 'n' : null }, c))))));
const stat = (k, v, unit, note) => el('div', { class: 'stat' }, el('span', { class: 'k' }, k),
  el('span', { class: 'v' }, v, unit ? el('small', {}, unit) : null), note ? el('span', { class: 'n' }, note) : null);

function jogos(ms) {
  if (!ms.length) return el('p', { class: 'dim' }, 'Nenhuma partida cadastrada.');
  const hm = (m) => (m.kickoffAt ? new Date(m.kickoffAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : 'Horário a definir');
  return el('table', {}, el('tbody', {}, ...ms.map((m) => {
    let r = el('span', { class: 'dim' }, hm(m));
    if (m.status === 'finished' && m.score) {
      const a = m.avaiHome ? m.score.home : m.score.away, b = m.avaiHome ? m.score.away : m.score.home;
      r = el('span', {}, `${m.score.home} x ${m.score.away}`, el('span', { class: 'res ' + (a > b ? 'w' : a < b ? 'l' : 'd') }, a > b ? 'Vitória' : a < b ? 'Derrota' : 'Empate'));
    }
    return el('tr', {}, el('td', {}, `Rodada ${m.round}`), el('td', {}, fmtDate(m.date)), el('td', {}, team(m.home), ' x ', team(m.away)), el('td', { class: 'n' }, r));
  })));
}

export function painel({ all, state, open }) {
  const w = all.filter((p) => p.official);
  const top = (k) => w.filter((p) => p[k] > 0).sort((a, b) => b[k] - a[k] || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 8);
  const rank = (title, k) => { const t = top(k); return el('section', { class: 'panel' }, el('h2', {}, title), t.length ? bars(t.map((p) => ({ label: p.name, value: p[k], tip: `${p.name}: ${p[k]}` }))) : el('p', { class: 'dim' }, 'Sem registros.')); };
  const cards = w.filter((p) => p.yellow > 0 || p.red > 0).sort((a, b) => b.yellow + b.red * 2 - (a.yellow + a.red * 2)).slice(0, 8);
  const sum = (k) => w.reduce((s, p) => s + (p[k] || 0), 0);
  const n = (f) => all.filter(f).length, of = (v) => `${v} de ${all.length}`;
  const pts = w.filter((p) => p.apps > 0).map((p) => ({ x: p.apps, y: (p.goals || 0) + (p.assists || 0), label: p.shirt ?? '', name: p.name, group: p.group, ref: p }));
  const ms = state.matches || [];
  const last = [...ms].reverse().find((m) => m.status === 'finished' && m.involvesAvai);
  const next = ms.find((m) => m.status === 'scheduled' && m.involvesAvai);
  const ages = all.map((p) => age(p.birth)).filter((a) => a != null);
  const vs = (m) => (m ? (m.avaiHome ? m.away : m.home) : '');
  const goals = (m) => (m.avaiHome ? [m.score.home, m.score.away] : [m.score.away, m.score.home]);
  const avaiScore = (m) => goals(m).join('×');
  const result = (m) => { const [a, b] = goals(m); return a > b ? 'Vitória' : a < b ? 'Derrota' : 'Empate'; };

  return el('div', { class: 'stack' },
    el('div', { class: 'scoreboard' },
      stat('Elenco profissional', String(all.length), ' atletas', ages.length ? `Idade média ${fmtN(mean(ages), 1)} anos` : null),
      stat('Gols na Série B', String(sum('goals')), null, `${sum('assists')} assistências registradas`),
      stat('Último jogo', last && last.score ? avaiScore(last) : '—', null, last ? `${result(last)} ${last.avaiHome ? 'em casa' : 'fora'} contra ${vs(last)}, ${fmtDate(last.date)}` : 'Sem jogo encerrado'),
      stat('Próximo jogo', next ? fmtDate(next.date).slice(0, 5) : '—', null, next ? `${next.avaiHome ? 'Em casa' : 'Fora'}, contra ${vs(next)}` : 'Sem jogo agendado'),
      stat('Alvos de mercado', String((state.market || []).length), null, `${(state.reports || []).length} relatórios`)),
    el('div', { class: 'cols wide' },
      el('section', { class: 'panel' }, el('h2', {}, 'Calendário'), jogos(ms)),
      el('div', { class: 'panel' }, widgetSection(state, 'competition', 'comp-serie-b', { heading: 'Série B no SofaScore', level: 'h2' }))),
    el('section', { class: 'panel' }, el('h2', {}, 'Quem participa de gols'),
      el('p', { class: 'meta' }, 'Cada marcador é um atleta, com o número da camisa: gols mais assistências por jogos disputados. Clique para abrir a ficha.'),
      pts.length ? scatter(pts, { xl: 'Jogos', yl: 'Gols + assistências', pick: open }) : el('p', { class: 'dim' }, 'Sem estatísticas carregadas.'),
      legend(ORDER.map((g) => ['g-' + g, GROUPS[g]]))),
    el('div', { class: 'cols' }, rank('Artilharia', 'goals'), rank('Assistências', 'assists'),
      el('section', { class: 'panel' }, el('h2', {}, 'Cartões'), cards.length ? bars(cards.map((p) => ({ label: p.name, value: p.yellow + p.red, parts: [{ v: p.yellow, c: 'y' }, { v: p.red, c: 'r' }], tip: `${p.name}: ${p.yellow} amarelos, ${p.red} vermelhos` }))) : el('p', { class: 'dim' }, 'Sem registros.'),
        legend([['y', 'Amarelos'], ['r', 'Vermelhos']]))),
    el('section', { class: 'panel' }, el('h2', {}, 'Completude do cadastro'), table([['Data de nascimento', of(n((p) => p.birth))], ['Altura', of(n((p) => p.height))], ['Peso', of(n((p) => p.weight !== '' && p.weight != null))],
      ['Pé dominante', of(n((p) => p.foot && p.foot !== 'Não informado'))], ['Vínculo com a ESPN a conferir', String(n((p) => p.review))]]),
      el('p', { class: 'meta', style: 'margin-top:8px' }, 'Contratos e minutos jogados ainda não têm fonte.')));
}
