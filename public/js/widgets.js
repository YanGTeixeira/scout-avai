import { el } from './util.js';
import { saveWidget, deleteWidget } from './api.js';

// Seção de widgets do SofaScore para uma entidade (atleta, clube, competição).
// Os widgets são só visuais: o conteúdo fica no SofaScore e não entra na base nem nas análises.
const newId = () => 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function frame(w, onRemove) {
  return el('figure', { class: 'widget' },
    el('iframe', { src: w.src, title: w.title || 'Widget do SofaScore', height: String(w.height), loading: 'lazy',
      referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox' }),
    el('figcaption', {}, el('span', {}, (w.title ? w.title + ' · ' : '') + 'Dados e visual: Sofascore'),
      el('button', { class: 'link', type: 'button', onclick: onRemove }, 'Remover')));
}

export function widgetSection(state, entityType, entityId, { heading = 'SofaScore', level = 'h3' } = {}) {
  const root = el('section', { class: 'widgets' });
  const mine = () => (state.widgets || []).filter((w) => w.entityType === entityType && w.entityId === entityId);

  function paint(msg) {
    const status = el('p', { class: 'meta', role: 'status' }, msg || '');
    const embed = el('textarea', { rows: '3', placeholder: '<iframe src="https://widgets.sofascore.com/..."></iframe>' });
    const title = el('input', { type: 'text', maxlength: '120', placeholder: 'Ex.: Desempenho na Série B' });
    const submit = async (e) => {
      e.preventDefault();
      status.textContent = 'Salvando…';
      try {
        const w = await saveWidget(newId(), { entityType, entityId, embed: embed.value, title: title.value });
        state.widgets = [...(state.widgets || []), w];
        paint('Widget adicionado.');
      } catch (err) { status.textContent = err.message; }
    };
    const remove = (w) => async () => {
      if (!confirm('Remover este widget?')) return;
      try {
        await deleteWidget(w.id);
        state.widgets = (state.widgets || []).filter((x) => x.id !== w.id);
        paint('Widget removido.');
      } catch (err) { status.textContent = err.message; }
    };
    const list = mine();
    root.replaceChildren(
      el(level, {}, heading),
      ...(list.length ? list.map((w) => frame(w, remove(w))) : [el('p', { class: 'dim' }, 'Nenhum widget do SofaScore vinculado.')]),
      el('details', { class: 'add-widget' },
        el('summary', {}, 'Adicionar widget do SofaScore'),
        el('form', { onsubmit: submit },
          el('p', { class: 'meta' }, 'No sofascore.com, abra a página do atleta, time ou campeonato, use a opção de incorporar (embed) e cole aqui o código do iframe ou o link. Só são aceitos links de widgets.sofascore.com.'),
          el('label', {}, 'Código do iframe ou link', embed),
          el('label', {}, 'Título (opcional)', title),
          el('button', { class: 'btn', type: 'submit' }, 'Salvar widget'))),
      status,
      el('p', { class: 'meta' }, 'Os números exibidos no widget pertencem ao SofaScore e não são gravados na base nem usados nas análises.'));
  }
  paint();
  return root;
}
