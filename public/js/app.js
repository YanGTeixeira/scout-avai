import { loadState } from './api.js';
import { $, el, empty, show, norm, fmtDate, fmtN } from './util.js';
import { GROUPS, ORDER, rateStats } from './metrics.js';
import { painel } from './painel.js';
import { comparador } from './comparador.js';
import { clube } from './clube.js';

const COLS = [
  { k: 'shirt', t: 'Nº', num: true, cls: 'no' },
  { k: 'name', t: 'Atleta' },
  { k: 'group', t: 'Posição' },
  { k: 'apps', t: 'Jogos', num: true },
  { k: 'starts', t: 'Titular', num: true },
  { k: 'goals', t: 'Gols', num: true },
  { k: 'assists', t: 'Assist.', num: true },
  { k: 'yellow', t: 'Amarelos', num: true },
  { k: 'red', t: 'Vermelhos', num: true },
];
const LABELS = {
  appearances: 'Jogos', startsDerived: 'Jogos como titular', substituteAppearances: 'Entradas como reserva', goals: 'Gols',
  assists: 'Assistências', shots: 'Finalizações', shotsOnTarget: 'Finalizações no alvo', saves: 'Defesas', goalsConceded: 'Gols sofridos',
  foulsCommitted: 'Faltas cometidas', foulsSuffered: 'Faltas sofridas', yellowCards: 'Cartões amarelos', redCards: 'Cartões vermelhos',
};

let all = [];
let state = {};
const ui = { q: '', group: '', sort: { k: 'group', dir: 1 }, cmp: { a: '', b: '' } };

const toRow = (p) => {
  const o = p.official || {};
  return { ...p, shirt: empty(p.shirt) ? null : p.shirt, apps: o.appearances, starts: o.startsDerived, goals: o.goals, assists: o.assists, yellow: o.yellowCards, red: o.redCards };
};
const sortVal = (p, k) => {
  if (k !== 'group') return p[k];
  const i = ORDER.indexOf(p.group);
  return (i < 0 ? 99 : i) * 1000 + (p.shirt ?? 999);
};
const cmp = (a, b, k, dir) => {
  const x = sortVal(a, k), y = sortVal(b, k);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * dir;
};
const visible = () => all
  .filter((p) => (!ui.group || p.group === ui.group) && (!ui.q || norm(p.name).includes(norm(ui.q))))
  .sort((a, b) => cmp(a, b, ui.sort.k, ui.sort.dir));

function cell(p, c) {
  if (c.k === 'name') {
    return el('td', {}, el('button', { class: 'who', onclick: () => openDrawer(p) }, p.name), p.review ? el('span', { class: 'flag' }, 'conferir fonte') : null);
  }
  const v = p[c.k === 'group' ? 'position' : c.k];
  const cls = [c.cls, c.num ? 'n' : '', empty(v) ? 'dim' : ''].filter(Boolean).join(' ');
  return el('td', { class: cls || null }, show(v));
}
function rows(list) {
  const out = [];
  const grouped = ui.sort.k === 'group';
  let last;
  for (const p of list) {
    if (grouped && p.group !== last) {
      last = p.group;
      const n = list.filter((x) => x.group === p.group).length;
      out.push(el('tr', { class: 'grp' }, el('td', { colspan: COLS.length }, `${GROUPS[p.group] || 'Outros'} (${n})`)));
    }
    out.push(el('tr', {}, ...COLS.map((c) => cell(p, c))));
  }
  return out.length ? out : [el('tr', {}, el('td', { colspan: COLS.length, class: 'state' }, 'Nenhum atleta encontrado com esse filtro.'))];
}

function elenco() {
  const body = el('tbody'), head = el('tr'), count = el('span', { class: 'count' });
  const paint = () => {
    const list = visible();
    body.replaceChildren(...rows(list));
    count.textContent = `${list.length} de ${all.length} atletas`;
    head.replaceChildren(...COLS.map((c) => {
      const on = ui.sort.k === c.k;
      const toggle = () => { ui.sort = { k: c.k, dir: on ? -ui.sort.dir : (c.num && c.k !== 'shirt' ? -1 : 1) }; paint(); };
      return el('th', { scope: 'col', class: c.num ? 'n' : null, 'aria-sort': on ? (ui.sort.dir > 0 ? 'ascending' : 'descending') : 'none' },
        el('button', { onclick: toggle }, c.t + (on ? (ui.sort.dir > 0 ? ' ↑' : ' ↓') : '')));
    }));
  };
  const search = el('input', { type: 'search', 'aria-label': 'Buscar atleta', placeholder: 'Buscar atleta', value: ui.q, oninput: (e) => { ui.q = e.target.value; paint(); } });
  const sel = el('select', { 'aria-label': 'Filtrar por posição', onchange: (e) => { ui.group = e.target.value; paint(); } },
    el('option', { value: '' }, 'Todas as posições'),
    ...ORDER.map((g) => el('option', { value: g, selected: ui.group === g }, GROUPS[g])));
  paint();
  return el('div', {}, el('div', { class: 'toolbar' }, search, sel, count),
    el('div', { class: 'sheet' }, el('table', {}, el('thead', {}, head), body)));
}

const drawer = $('#drawer'), scrim = $('#scrim');
let lastFocus = null;
const list = (pairs) => el('dl', {}, ...pairs.flatMap(([k, v]) => [el('dt', {}, k), el('dd', { class: empty(v) ? 'dim' : null }, empty(v) ? 'Não informado' : String(v))]));
function rates(p) {
  const rs = p.official ? rateStats(p, all) : [];
  if (!rs.length) return [];
  return [el('h3', {}, 'Ritmo por jogo'),
    ...rs.map((r) => el('div', { class: 'rate' }, el('span', {}, r.l),
      el('span', { class: 'rt' }, el('i', { style: `width:${r.max ? (r.v / r.max) * 100 : 0}%` }), r.avg != null ? el('u', { style: `left:${r.max ? (r.avg / r.max) * 100 : 0}%`, title: 'Média da posição' }) : null),
      el('b', {}, fmtN(r.v, r.d)))),
    el('p', { class: 'meta' }, 'A marca vertical é a média da posição entre atletas com 5 jogos ou mais.' + (p.apps < 5 ? ' Este atleta tem menos de 5 jogos: leia com cautela.' : ''))];
}
function openDrawer(p) {
  lastFocus = document.activeElement;
  const o = p.official;
  const stats = o
    ? [list(Object.keys(LABELS).filter((k) => o[k] != null).map((k) => [LABELS[k], o[k]])), el('p', { class: 'meta' }, `Fonte: ESPN Deportes, até ${fmtDate(p.asOf)}. Minutos jogados não são divulgados.`)]
    : [el('p', { class: 'dim' }, 'A fonte não traz estatísticas para este atleta.')];
  drawer.replaceChildren(
    el('button', { class: 'btn close', onclick: closeDrawer }, 'Fechar'),
    el('h2', { id: 'd-title' }, p.name),
    el('p', { class: 'sub' }, (p.shirt != null ? `Camisa ${p.shirt}, ` : '') + (p.position || 'posição não informada')),
    p.review ? el('p', { class: 'flag' }, 'O vínculo deste atleta com a fonte de estatísticas precisa ser conferido: nome ou camisa na fonte diferem dos do clube.') : null,
    el('h3', {}, 'Cadastro'),
    list([['Clube', p.club], ['Nascimento', p.birth], ['Altura', p.height ? p.height + ' cm' : ''], ['Pé dominante', p.foot === 'Não informado' ? '' : p.foot], ['Status', p.status]]),
    el('h3', {}, 'Série B 2026'), ...stats, ...rates(p),
    el('p', {}, el('button', { class: 'btn', onclick: () => { ui.cmp.a = p.id; closeDrawer(); location.hash = '#/comparador'; } }, 'Comparar com outro atleta')));
  drawer.classList.add('open'); scrim.classList.add('open');
  drawer.querySelector('.close').focus();
  document.addEventListener('keydown', onKey);
}
function closeDrawer() {
  drawer.classList.remove('open'); scrim.classList.remove('open');
  document.removeEventListener('keydown', onKey);
  if (lastFocus) lastFocus.focus();
}
function onKey(e) {
  if (e.key === 'Escape') return closeDrawer();
  if (e.key !== 'Tab') return;
  const f = [...drawer.querySelectorAll('button,[href],input,select')];
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
scrim.addEventListener('click', closeDrawer);

const routes = {
  painel: ['Painel', () => painel(all, state, openDrawer)],
  elenco: ['Elenco atual', elenco],
  comparador: ['Comparador', () => comparador(all, ui.cmp)],
  clube: ['Clube', () => clube(state)],
};
function route() {
  const m = location.hash.match(/^#\/(\w+)/);
  const key = m && routes[m[1]] ? m[1] : 'painel';
  const [title, view] = routes[key];
  $('#title').textContent = title;
  document.title = `${title} - Scout Avaí`;
  document.querySelectorAll('[data-route]').forEach((a) => (a.dataset.route === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const asOf = all.find((p) => p.asOf)?.asOf;
  $('#meta').textContent = `${all.length} atletas no elenco. Série B 2026${asOf ? ', estatísticas até ' + fmtDate(asOf) : ''}.`;
  $('#main').replaceChildren(view());
}
function fail(msg) {
  $('#main').replaceChildren(el('div', { class: 'state' }, el('p', {}, msg), el('button', { class: 'btn', onclick: boot }, 'Tentar de novo')));
}
async function boot() {
  $('#title').textContent = 'Elenco atual';
  $('#main').replaceChildren(el('p', { class: 'state' }, 'Carregando elenco…'));
  try {
    const s = await loadState();
    state = s;
    all = s.players.filter((p) => p.category === 'Profissional').map(toRow);
    if (!all.length) return fail('Nenhum atleta no banco. Rode node seed.js para carregar o elenco inicial.');
    route();
  } catch (e) {
    fail('Não foi possível carregar os dados. Confira se o servidor está rodando e conectado ao MongoDB.');
  }
}
const themeBtn = $('#theme');
const themeLabel = () => { const d = document.documentElement.dataset.theme === 'dark'; themeBtn.textContent = d ? 'Tema claro' : 'Tema escuro'; themeBtn.setAttribute('aria-pressed', String(d)); };
themeBtn.addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('scout_theme', t); } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
  themeLabel();
});
themeLabel();
window.addEventListener('hashchange', () => { if (all.length) route(); });
boot();
