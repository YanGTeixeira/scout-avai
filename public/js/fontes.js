import { el, fmtDate } from './util.js';
import { exportBackup } from './atletas.js';

const REL = { high: 'Alta', medium: 'Média', low: 'Baixa', unverified: 'Não verificada' };

export function fontes({ state, setActions }) {
  setActions(el('button', { class: 'btn primary', onclick: () => exportBackup(state) }, 'Exportar backup'));
  const src = [...(state.sources || [])].sort((a, b) => Number(b.usedInLoad) - Number(a.usedInLoad) || a.name.localeCompare(b.name, 'pt-BR'));
  const verified = (state.players || []).map((p) => p.profileSource && p.profileSource.lastVerifiedAt).filter(Boolean).sort().pop();
  return el('div', { class: 'stack' },
    el('section', { class: 'panel' }, el('h2', {}, 'Fontes cadastradas'),
      el('p', { class: 'meta' }, verified ? `Elenco conferido no site oficial do Avaí em ${fmtDate(verified)}. Para atualizar, rode npm run sync:avai.` : 'O elenco ainda não foi atualizado pelo site oficial. Rode npm run sync:avai.'),
      el('div', { class: 'sheet', style: 'max-height:none' }, el('table', {},
        el('thead', {}, el('tr', {}, ...['Fonte', 'Confiabilidade', 'Em uso', 'O que cobre'].map((t) => el('th', { scope: 'col' }, t)))),
        el('tbody', {}, ...src.map((s) => el('tr', {},
          el('td', {}, s.url && /^https?:/.test(s.url) ? el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name) : s.name),
          el('td', {}, REL[s.reliability] || s.reliability || '—'), el('td', {}, s.usedInLoad ? 'Sim' : 'Não'),
          el('td', { class: 'wrap' }, s.scope || '—'))))))),
    el('section', { class: 'panel' }, el('h2', {}, 'Backup'),
      el('p', {}, 'O backup é um arquivo JSON com atletas, alvos de mercado, relatórios, linha do tempo, modelo de jogo e widgets. Os dados ficam no MongoDB; o arquivo serve como cópia de segurança.')));
}
