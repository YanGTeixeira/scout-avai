import { el, norm, age, fmtDate } from './util.js';
import { saveItem, deleteItem, newId } from './api.js';
import { formDialog, toast } from './ui.js';

const CATEGORIES = ['Profissional', 'Sub-20', 'Sub-17', 'Sub-15', 'Histórico'];
const POSITIONS = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meio-campo', 'Meia', 'Atacante', 'Ponta', 'Centroavante'];
const STATUS = ['Elenco', 'Mercado', 'Emprestado', 'Histórico'];
const FOOT = ['Não informado', 'Direito', 'Esquerdo', 'Ambos'];
const FIELDS = [
  { name: 'name', label: 'Nome', required: true },
  { name: 'birth', label: 'Data de nascimento', type: 'date' },
  { name: 'club', label: 'Clube', value: 'Avaí' },
  { name: 'category', label: 'Categoria', type: 'select', options: CATEGORIES },
  { name: 'position', label: 'Posição', type: 'select', options: POSITIONS },
  { name: 'foot', label: 'Pé dominante', type: 'select', options: FOOT },
  { name: 'season', label: 'Temporada', value: String(new Date().getFullYear()) },
  { name: 'status', label: 'Status', type: 'select', options: STATUS },
  { name: 'height', label: 'Altura (cm)', type: 'number', min: '140' },
  { name: 'minutes', label: 'Minutos na temporada', type: 'number', min: '0' },
  { name: 'goals', label: 'Gols', type: 'number', min: '0' },
  { name: 'assists', label: 'Assistências', type: 'number', min: '0' },
  { name: 'notes', label: 'Observações e fonte dos dados', type: 'textarea', wide: true, placeholder: 'Inclua fonte, link e data da verificação.' },
];
const CSV_HEADER = 'name,club,category,position,birth,foot,season,status,height,minutes,goals,assists,notes';
const f = { q: '', category: '', position: '', status: '' };

// Linha de CSV com aspas e vírgulas dentro de campos.
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
const download = (name, text, type) => {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export function exportBackup(state) {
  const payload = { exportedAt: new Date().toISOString(), players: state.players, market: state.market, reports: state.reports, history: state.history, tactical: state.tactical, roles: state.roles, widgets: state.widgets };
  download(`scout-avai-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

export function atletas({ state, refresh, setActions }) {
  const items = state.players || [];
  const edit = (p) => formDialog({ title: p ? `Editar ${p.name}` : 'Cadastrar atleta', fields: FIELDS, values: p || {}, submitLabel: p ? 'Salvar atleta' : 'Cadastrar atleta',
    onSubmit: async (d) => { await saveItem('players', p ? p.id : newId('atl'), { ...(p || {}), ...d }); toast(p ? 'Cadastro atualizado.' : 'Atleta cadastrado.'); await refresh(); } });
  const del = (p) => async () => {
    const extra = p.profileSource ? '\nEle está na página oficial do clube e volta na próxima atualização do elenco.' : '';
    if (!confirm(`Excluir o cadastro de ${p.name}?${extra}`)) return;
    await deleteItem('players', p.id); toast('Cadastro excluído.'); await refresh();
  };
  const file = el('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: async (e) => {
    const fl = e.target.files[0]; e.target.value = '';
    if (!fl) return;
    const lines = (await fl.text()).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    const head = parseCsvLine(lines.shift() || '');
    if (!head.includes('name')) { toast('O arquivo precisa ter a coluna "name". Baixe o modelo.'); return; }
    let ok = 0;
    for (const line of lines) {
      const vals = parseCsvLine(line), d = Object.fromEntries(head.map((h, i) => [h, vals[i] || '']));
      if (!d.name) continue;
      await saveItem('players', newId('atl'), { club: 'Avaí', category: 'Profissional', status: 'Elenco', foot: 'Não informado', ...d });
      ok++;
    }
    toast(`${ok} atleta(s) importado(s).`); await refresh();
  } });
  setActions(
    el('button', { class: 'btn', onclick: () => download('modelo-importacao-atletas.csv', CSV_HEADER + '\n', 'text/csv') }, 'Baixar modelo CSV'),
    el('button', { class: 'btn', onclick: () => file.click() }, 'Importar CSV'), file,
    el('button', { class: 'btn primary', onclick: () => edit() }, 'Cadastrar atleta'));

  const body = el('tbody'), count = el('span', { class: 'count' });
  const paint = () => {
    const list = items.filter((p) => (!f.q || norm(p.name + ' ' + (p.fullName || '') + ' ' + p.club).includes(norm(f.q))) && (!f.category || p.category === f.category)
      && (!f.position || p.position === f.position) && (!f.status || p.status === f.status))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    count.textContent = `${list.length} de ${items.length} atletas`;
    body.replaceChildren(...(list.length ? list.map((p) => {
      const a = age(p.birth);
      return el('tr', {},
        el('td', {}, el('b', {}, p.name), p.fullName && p.fullName !== p.name ? el('div', { class: 'meta' }, p.fullName) : null),
        el('td', {}, p.club || '—'), el('td', {}, el('span', { class: 'tag' }, p.category || '—')), el('td', {}, p.position || '—'),
        el('td', { class: 'n' }, a != null ? `${a}` : '—'), el('td', {}, p.birth ? fmtDate(p.birth) : '—'),
        el('td', {}, p.listed === false ? el('span', { class: 'tag hi' }, 'Fora da página do clube') : el('span', { class: 'tag' + (p.status === 'Elenco' ? ' ok' : '') }, p.status || '—')),
        el('td', {}, p.profileSource ? 'Site do clube' : el('span', { class: 'dim' }, 'Manual')),
        el('td', { class: 'n' }, el('button', { class: 'btn small', onclick: () => edit(p) }, 'Editar'), ' ', el('button', { class: 'btn small danger', onclick: del(p) }, 'Excluir')));
    }) : [el('tr', {}, el('td', { colspan: 9, class: 'state' }, 'Nenhum atleta com esse filtro.'))]));
  };
  const sel = (key, label, opts) => el('select', { 'aria-label': label, onchange: (e) => { f[key] = e.target.value; paint(); } }, el('option', { value: '' }, label), ...opts.map((o) => el('option', { selected: f[key] === o }, o)));
  paint();
  return el('div', { class: 'stack' },
    el('p', { class: 'notice' }, 'Atletas do elenco profissional são atualizados pelo site oficial do clube. Um campo alterado aqui passa a valer como cadastro manual e não é sobrescrito pela atualização: se o site trouxer outro valor, a divergência fica registrada.'),
    el('div', {}, el('div', { class: 'toolbar' },
      el('input', { type: 'search', placeholder: 'Buscar nome ou clube', 'aria-label': 'Buscar nome ou clube', value: f.q, oninput: (e) => { f.q = e.target.value; paint(); } }),
      sel('category', 'Todas as categorias', CATEGORIES), sel('position', 'Todas as posições', POSITIONS), sel('status', 'Todos os status', STATUS), count),
      el('div', { class: 'sheet' }, el('table', {}, el('thead', {}, el('tr', {}, ...['Atleta', 'Clube', 'Categoria', 'Posição', 'Idade', 'Nascimento', 'Status', 'Origem', ''].map((t, i) => el('th', { scope: 'col', class: i === 4 ? 'n' : null }, t)))), body))));
}
