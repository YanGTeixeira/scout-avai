import { el, norm } from './util.js';
import { saveItem, deleteItem, newId } from './api.js';
import { formDialog, toast } from './ui.js';
import { bars } from './charts.js';

const POSITIONS = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meio-campo', 'Atacante'];
const PRIORITIES = ['Alta', 'Média', 'Baixa'];
const STAGES = ['Observação', 'Análise', 'Contato', 'Negociação', 'Descartado'];
const FIELDS = [
  { name: 'name', label: 'Nome do atleta', required: true },
  { name: 'club', label: 'Clube atual' },
  { name: 'position', label: 'Posição', type: 'select', options: ['', ...POSITIONS] },
  { name: 'priority', label: 'Prioridade', type: 'select', options: PRIORITIES, value: 'Média' },
  { name: 'stage', label: 'Etapa', type: 'select', options: STAGES, value: 'Observação' },
  { name: 'note', label: 'Observações e fonte', type: 'textarea', wide: true, placeholder: 'O que chamou atenção, onde foi visto, fonte e data da informação.' },
];
const f = { q: '', priority: '', stage: '' };
const stat = (k, v, note) => el('div', { class: 'stat' }, el('span', { class: 'k' }, k), el('span', { class: 'v' }, v), note ? el('span', { class: 'n' }, note) : null);

export function mercado({ state, refresh, setActions }) {
  const items = state.market || [];
  const edit = (m) => formDialog({ title: m ? 'Editar alvo' : 'Adicionar alvo de mercado', fields: FIELDS, values: m || {}, submitLabel: m ? 'Salvar alvo' : 'Adicionar alvo',
    onSubmit: async (d) => { await saveItem('market', m ? m.id : newId('alvo'), d); toast(m ? 'Alvo atualizado.' : 'Alvo adicionado.'); await refresh(); } });
  const del = (m) => async () => { if (!confirm(`Remover ${m.name} dos alvos?`)) return; await deleteItem('market', m.id); toast('Alvo removido.'); await refresh(); };
  setActions(el('button', { class: 'btn primary', onclick: () => edit() }, 'Adicionar alvo'));

  const body = el('tbody');
  const paint = () => {
    const list = items.filter((m) => (!f.q || norm(m.name + ' ' + m.club).includes(norm(f.q))) && (!f.priority || m.priority === f.priority) && (!f.stage || m.stage === f.stage));
    body.replaceChildren(...(list.length ? list.map((m) => el('tr', {},
      el('td', {}, el('b', {}, m.name)), el('td', {}, m.club || '—'), el('td', {}, m.position || '—'),
      el('td', {}, el('span', { class: 'tag' + (m.priority === 'Alta' ? ' hi' : '') }, m.priority || '—')), el('td', {}, m.stage || '—'),
      el('td', { class: 'wrap' }, m.note || el('span', { class: 'dim' }, 'Sem observações')),
      el('td', { class: 'n' }, el('button', { class: 'btn small', onclick: () => edit(m) }, 'Editar'), ' ', el('button', { class: 'btn small danger', onclick: del(m) }, 'Remover'))))
      : [el('tr', {}, el('td', { colspan: 7, class: 'state' }, items.length ? 'Nenhum alvo com esse filtro.' : 'Nenhum alvo cadastrado. Use "Adicionar alvo" para começar.'))]));
  };
  const sel = (key, label, opts) => el('select', { 'aria-label': label, onchange: (e) => { f[key] = e.target.value; paint(); } }, el('option', { value: '' }, label), ...opts.map((o) => el('option', { selected: f[key] === o }, o)));
  paint();
  const byPos = POSITIONS.map((p) => ({ label: p, value: items.filter((m) => m.position === p).length })).filter((x) => x.value);
  const byStage = STAGES.map((s) => ({ label: s, value: items.filter((m) => m.stage === s).length })).filter((x) => x.value);
  return el('div', { class: 'stack' },
    el('div', { class: 'scoreboard' },
      stat('Alvos', String(items.length)), stat('Prioridade alta', String(items.filter((m) => m.priority === 'Alta').length)),
      stat('Em observação', String(items.filter((m) => m.stage === 'Observação').length)), stat('Em negociação', String(items.filter((m) => m.stage === 'Negociação').length))),
    items.length ? el('div', { class: 'cols' },
      el('section', { class: 'panel' }, el('h2', {}, 'Alvos por posição'), byPos.length ? bars(byPos) : el('p', { class: 'dim' }, 'Sem posição informada.')),
      el('section', { class: 'panel' }, el('h2', {}, 'Alvos por etapa'), byStage.length ? bars(byStage) : el('p', { class: 'dim' }, 'Sem etapa informada.'))) : null,
    el('p', { class: 'notice' }, 'Disponibilidade, contrato e valores de alvos precisam ser conferidos em fonte confiável. Registre a fonte nas observações.'),
    el('div', {}, el('div', { class: 'toolbar' },
      el('input', { type: 'search', placeholder: 'Buscar atleta ou clube', 'aria-label': 'Buscar atleta ou clube', value: f.q, oninput: (e) => { f.q = e.target.value; paint(); } }),
      sel('priority', 'Todas as prioridades', PRIORITIES), sel('stage', 'Todas as etapas', STAGES)),
      el('div', { class: 'sheet' }, el('table', {}, el('thead', {}, el('tr', {}, ...['Atleta', 'Clube atual', 'Posição', 'Prioridade', 'Etapa', 'Observações', ''].map((t) => el('th', { scope: 'col' }, t)))), body))));
}
