import { el, sv, fmtDate, fmtN } from './util.js';
import { widgetSection } from './widgets.js';
import { saveItem, deleteItem, newId } from './api.js';
import { formDialog, toast } from './ui.js';

const kv = (pairs) => el('dl', {}, ...pairs.flatMap(([k, v]) => [el('dt', {}, k), el('dd', { class: v == null || v === '' ? 'dim' : null }, v == null || v === '' ? 'Não informado' : String(v))]));
const Y0 = 1920;
const strip = (t) => sv('svg', { viewBox: '0 0 1100 18', class: 'strip', role: 'img', 'aria-label': `${t.name}: ${t.years.join(', ')}` },
  sv('line', { x1: 0, x2: 1100, y1: 9, y2: 9, class: 'axis' }),
  ...t.years.map((y) => sv('rect', { x: (y - Y0) * 10 - 2, y: 0, width: 5, height: 18, class: t.kind === 'vice' ? 'tick vice' : 'tick' }, sv('title', {}, String(y)))));

const FACT_FIELDS = [
  { name: 'date', label: 'Data ou temporada', required: true, placeholder: 'AAAA, AAAA-MM ou AAAA-MM-DD' },
  { name: 'title', label: 'Título do registro', required: true },
  { name: 'type', label: 'Categoria', placeholder: 'Campanha, título, treinador, atleta…' },
  { name: 'source', label: 'Fonte ou link', placeholder: 'https://…' },
  { name: 'detail', label: 'Descrição', type: 'textarea', wide: true },
];

export function clube({ state, refresh, setActions }) {
  const addFact = () => formDialog({ title: 'Registrar fato histórico', fields: FACT_FIELDS, submitLabel: 'Registrar fato',
    onSubmit: async (d) => { await saveItem('history', newId('hist'), d); toast('Fato registrado.'); await refresh(); } });
  const delFact = (h) => async () => {
    if (!confirm(`Excluir "${h.title}" da linha do tempo?`)) return;
    await deleteItem('history', h.id); toast('Fato excluído.'); await refresh();
  };
  setActions(el('button', { class: 'btn primary', onclick: addFact }, 'Registrar fato'));
  const c = state.club || {}, st = state.stadiums || [];
  const r = st.find((s) => s._id === 'stadium-ressacada') || {}, cfa = st.find((s) => s._id === 'stadium-cfa-joao-nilson-zunino') || {};
  const rec = r.attendanceRecord;
  const titles = [...(state.titles || [])].sort((a, b) => (a.kind === b.kind ? b.count - a.count : a.kind === 'campeao' ? -1 : 1));
  const hist = [...(state.history || [])].sort((a, b) => b.date.localeCompare(a.date));
  const link = (u) => (/^https?:\/\//.test(u) ? el('a', { href: u, target: '_blank', rel: 'noopener' }, 'Fonte') : null);
  return el('div', { class: 'stack' },
    el('div', { class: 'cols' },
      el('section', { class: 'panel' }, el('h2', {}, c.name || 'Avaí Futebol Clube'), kv([
        ['Fundação', c.foundedYear], ['Cidade', c.city && `${c.city}, ${c.state}`], ['Cores', (c.colors || []).join(' e ')], ['Apelidos', (c.nicknames || []).join(', ')],
        ['Torcida estimada', c.fanbase && `${fmtN(c.fanbase.estimatedSupporters)} (${c.fanbase.year})`], ['Sócios', c.membersCount && `${fmtN(c.membersCount.value)} em ${fmtDate(c.membersCount.collectedAt)}`]])),
      el('section', { class: 'panel' }, el('h2', {}, `Ressacada${r.popularName ? '' : ''}`), kv([
        ['Estádio', r.name], ['Capacidade', fmtN(r.capacity)], ['Inauguração', fmtDate(r.inauguratedAt)], ['Recorde de público', rec && `${fmtN(rec.attendance)} em ${fmtDate(rec.date)}`],
        ['Centro de treinamento', cfa.name && `${cfa.fields} campos`]]))),
    el('div', { class: 'panel' }, widgetSection(state, 'club', 'club-avai', { heading: 'Avaí no SofaScore', level: 'h2' })),
    el('section', { class: 'panel' }, el('h2', {}, 'Títulos'),
      el('p', { class: 'meta' }, 'Cada marca é uma temporada, de 1920 a 2030. Marca vazada indica vice-campeonato.'),
      ...titles.map((t) => el('div', { class: 'tl' }, el('span', {}, `${t.name} (${t.count})`), strip(t)))),
    el('section', { class: 'panel' }, el('h2', {}, 'Linha do tempo'),
      el('ul', { class: 'timeline' }, ...hist.map((h) => el('li', {}, el('time', {}, fmtDate(h.date)), el('div', {}, el('b', {}, h.title), h.detail ? el('p', {}, h.detail) : null, link(h.source)),
        el('button', { class: 'btn small danger', onclick: delFact(h) }, 'Excluir'))))));
}
