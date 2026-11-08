import { el } from './util.js';
import { saveTactical, saveRoles } from './api.js';
import { formDialog, toast } from './ui.js';

const ROLES = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meio-campo', 'Atacante'];

export function modelo({ state, refresh }) {
  const t = state.tactical || {};
  const roles = state.roles || [];
  const text = el('textarea', { rows: '7', placeholder: 'Organização defensiva, altura de pressão, saída de bola, transições, bolas paradas…' }); text.value = t.text || '';
  const formation = el('input', { value: t.formation || '', placeholder: 'Ex.: 4-2-3-1' });
  const pressing = el('select', {}, ...['', 'Alta', 'Média', 'Baixa'].map((o) => el('option', { value: o, selected: (t.pressing || '') === o }, o || 'Não definida')));
  const save = async (e) => {
    e.preventDefault();
    await saveTactical({ text: text.value, formation: formation.value, pressing: pressing.value });
    toast('Modelo de jogo salvo.'); await refresh();
  };
  const addRole = () => formDialog({ title: 'Adicionar requisito', submitLabel: 'Adicionar requisito', fields: [
    { name: 'position', label: 'Posição ou função', type: 'select', options: ROLES, required: true },
    { name: 'requirement', label: 'Característica desejada', type: 'textarea', wide: true, required: true, placeholder: 'Ex.: lateral que ataca por dentro, bom passe sob pressão' }],
    onSubmit: async (d) => { await saveRoles([...roles, { position: d.position, requirement: d.requirement }]); toast('Requisito adicionado.'); await refresh(); } });
  const removeRole = (i) => async () => { if (!confirm('Remover este requisito?')) return; await saveRoles(roles.filter((_, j) => j !== i)); toast('Requisito removido.'); await refresh(); };
  const byRole = ROLES.map((r) => [r, roles.map((x, i) => [x, i]).filter(([x]) => x.position === r)]).filter(([, xs]) => xs.length);
  const other = roles.map((x, i) => [x, i]).filter(([x]) => !ROLES.includes(x.position));
  return el('div', { class: 'cols wide' },
    el('section', { class: 'panel' }, el('h2', {}, 'Identidade de jogo'),
      el('form', { class: 'formgrid', onsubmit: save },
        el('label', { class: 'wide' }, 'Descrição do modelo', text),
        el('label', {}, 'Formação base', formation),
        el('label', {}, 'Altura de pressão', pressing),
        el('div', { class: 'wide' }, el('button', { class: 'btn primary', type: 'submit' }, 'Salvar modelo')))),
    el('section', { class: 'panel' },
      el('div', { class: 'panel-head' }, el('h2', {}, 'Requisitos por função'), el('button', { class: 'btn', onclick: addRole }, 'Adicionar requisito')),
      el('p', { class: 'meta' }, 'O que a comissão técnica procura em cada função. São critérios editáveis, não uma avaliação automática.'),
      roles.length ? el('ul', { class: 'reqs' }, ...[...byRole.flatMap(([, xs]) => xs), ...other].map(([x, i]) => el('li', {},
        el('div', {}, el('b', {}, x.position), x.requirement), el('button', { class: 'btn small danger', onclick: removeRole(i) }, 'Remover'))))
        : el('div', { class: 'empty' }, el('b', {}, 'Nenhum requisito cadastrado'), 'Adicione o perfil desejado para cada posição.')));
}
