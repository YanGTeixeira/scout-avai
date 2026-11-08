import { el } from './util.js';
import { saveItem, deleteItem, newId } from './api.js';
import { formDialog, toast } from './ui.js';
import { renderMarkdown } from './ia.js';

const TYPES = ['Contratação', 'Renovação', 'Acompanhamento', 'Avaliação de desempenho', 'Adversário', 'Sugestão da IA'];
const VERDICTS = ['Contratar', 'Monitorar', 'Renovar', 'Não avançar', 'Sem parecer'];
const fields = (names) => [
  { name: 'title', label: 'Título', required: true },
  { name: 'type', label: 'Tipo', type: 'select', options: TYPES },
  { name: 'player', label: 'Atleta relacionado', placeholder: 'Nome do atleta' },
  { name: 'recommendation', label: 'Parecer', type: 'select', options: VERDICTS, value: 'Monitorar' },
  { name: 'evidence', label: 'Evidências e análise', type: 'textarea', wide: true, required: true, rows: 6 },
  { name: 'sources', label: 'Fontes consultadas', wide: true, placeholder: 'Jogos vistos, vídeos, dados, com datas' },
];
let filter = '';

export function relatorios({ state, refresh, setActions }) {
  const items = state.reports || [];
  const edit = (r) => formDialog({ title: r ? 'Editar relatório' : 'Novo relatório', fields: fields(), values: r || {}, submitLabel: r ? 'Salvar relatório' : 'Criar relatório',
    onSubmit: async (d) => {
      await saveItem('reports', r ? r.id : newId('rel'), { ...d, date: r ? r.date : new Date().toLocaleDateString('pt-BR') });
      toast(r ? 'Relatório atualizado.' : 'Relatório criado.'); await refresh();
    } });
  const del = (r) => async () => { if (!confirm(`Excluir o relatório "${r.title}"?`)) return; await deleteItem('reports', r.id); toast('Relatório excluído.'); await refresh(); };
  setActions(el('button', { class: 'btn primary', onclick: () => edit() }, 'Novo relatório'));
  const list = el('div', { class: 'cards' });
  const paint = () => {
    const rs = items.filter((r) => !filter || r.type === filter);
    list.replaceChildren(...(rs.length ? rs.map((r) => el('article', { class: 'card' },
      el('div', {}, el('span', { class: 'tag' }, r.type || 'Relatório')),
      el('h3', {}, r.title),
      el('p', { class: 'meta' }, [r.date, r.player || 'Sem atleta vinculado'].filter(Boolean).join(', ')),
      r.type === 'Sugestão da IA' ? el('details', {}, el('summary', {}, 'Ver sugestão completa'), renderMarkdown(r.evidence || '')) : el('p', {}, r.evidence),
      el('p', { class: 'verdict' }, `Parecer: ${r.recommendation || 'não definido'}`),
      el('p', { class: 'meta' }, `Fontes: ${r.sources || 'não informadas'}`),
      el('footer', {}, el('span'), el('span', {}, el('button', { class: 'btn small', onclick: () => edit(r) }, 'Editar'), ' ', el('button', { class: 'btn small danger', onclick: del(r) }, 'Excluir')))))
      : [el('div', { class: 'empty' }, el('b', {}, items.length ? 'Nenhum relatório desse tipo' : 'Nenhum relatório criado'), 'Registre um parecer para começar o histórico de decisões.')]));
  };
  paint();
  return el('div', { class: 'stack' },
    el('p', { class: 'notice' }, 'Pareceres apoiam a decisão. A aprovação final considera observação presencial ou em vídeo, avaliação médica, contexto contratual e a comissão técnica.'),
    el('div', { class: 'toolbar' }, el('select', { 'aria-label': 'Filtrar por tipo', onchange: (e) => { filter = e.target.value; paint(); } },
      el('option', { value: '' }, 'Todos os tipos'), ...TYPES.map((t) => el('option', { selected: filter === t }, t))),
      el('span', { class: 'count' }, `${items.length} relatórios`)),
    list);
}
