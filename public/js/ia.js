import { el, fmtDate } from './util.js';
import { saveItem, newId } from './api.js';
import { toast } from './ui.js';

// Assistente de IA local: lê os dados do sistema e sugere treinos, táticas, esquemas, jogadas ensaiadas e escalações.
// Tudo é apresentado como sugestão para a comissão técnica, nunca como decisão.
const MODES = [
  { k: 'treinos', l: 'Treinos da semana', d: 'Microciclo até o próximo jogo, com exercícios e carga.', opp: true },
  { k: 'taticas', l: 'Táticas para treinar', d: 'Comportamentos prioritários por fase do jogo.', opp: true },
  { k: 'esquemas', l: 'Esquemas táticos', d: 'Sistemas que cabem no elenco, com prós e riscos.' },
  { k: 'bolaParada', l: 'Jogadas ensaiadas', d: 'Escanteios, faltas e laterais, usando a altura do elenco.' },
  { k: 'escalacao', l: 'Escalação', d: 'Titulares e banco, com justificativa e alternativas.', opp: true, form: true },
  { k: 'livre', l: 'Pergunta livre', d: 'Qualquer pergunta sobre o elenco e os dados.' },
];
const S = { mode: 'treinos', opponent: null, formation: null, note: '', history: [], answer: '', model: '', at: null, busy: false, ctrl: null };

// Markdown simples → DOM (só textContent; nada de HTML vindo da IA).
function inline(text) {
  const out = []; const re = /\*\*(.+?)\*\*/g; let last = 0, m;
  while ((m = re.exec(text))) { if (m.index > last) out.push(text.slice(last, m.index)); out.push(el('strong', {}, m[1])); last = re.lastIndex; }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
export function renderMarkdown(md) {
  const root = el('div', { class: 'md' });
  let list = null, para = [];
  const flush = () => { if (para.length) { root.append(el('p', {}, ...inline(para.join(' ')))); para = []; } };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/), li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); list = null; root.append(el('hr')); }
    else if (h) { flush(); list = null; root.append(el(h[1].length <= 2 ? 'h3' : 'h4', {}, ...inline(h[2].replace(/\*\*/g, '')))); }
    else if (li) { flush(); if (!list) { list = el(/^\s*\d/.test(line) ? 'ol' : 'ul'); root.append(list); } list.append(el('li', {}, ...inline(li[1]))); }
    else if (!line.trim()) { flush(); list = null; }
    else { if (list) { list.lastChild && list.lastChild.append(' ', ...inline(line.trim())); } else para.push(line.trim()); }
  }
  flush();
  return root;
}

async function getJson(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }

export function ia({ state, refresh }) {
  const root = el('div', { class: 'stack' });
  const statusBox = el('section', { class: 'panel' }, el('p', { class: 'meta' }, 'Verificando a IA local…'));
  const out = el('div', { class: 'ai-out', 'aria-live': 'polite' });
  const outPanel = el('section', { class: 'panel ai-answer' });
  const historyBox = el('section', { class: 'panel' });
  let status = null;

  const paintStatus = () => {
    if (!status) return;
    const o = status.ollama;
    if (o.online && o.modelInstalled) {
      statusBox.replaceChildren(el('div', { class: 'panel-head' }, el('h2', {}, 'IA local conectada'), el('span', { class: 'tag ok' }, o.model)),
        el('p', { class: 'meta' }, `Roda na sua máquina pelo Ollama (${o.url}). Os dados do Scout Avaí não saem da rede local. A cada pedido a IA recebe um retrato atualizado do banco: ${status.summary.players} atletas, estatísticas até ${status.summary.statsAsOf ? fmtDate(status.summary.statsAsOf) : 'data não informada'}${status.summary.formation ? `, formação base ${status.summary.formation}` : ''}.`));
      return;
    }
    const steps = o.online
      ? [['O Ollama está rodando, mas o modelo configurado não foi baixado:', `ollama pull ${o.model}`]]
      : [['1. Instale o Ollama: ollama.com/download', null], ['2. Baixe um modelo (uma vez):', `ollama pull ${o.model}`], ['3. Deixe o Ollama aberto (ou rode):', 'ollama serve']];
    statusBox.replaceChildren(el('h2', {}, o.online ? 'Modelo não instalado' : 'IA local desligada'),
      el('p', {}, o.error || 'Falta baixar o modelo.'),
      ...steps.map(([t, cmd]) => el('div', { class: 'step' }, el('p', {}, t), cmd ? el('pre', { class: 'cmd' }, cmd) : null)),
      el('p', { class: 'meta' }, `Para usar outro modelo ou endereço, inicie o servidor com OLLAMA_MODEL (ex.: llama3.1:8b, gemma2:9b) e OLLAMA_URL. Modelos maiores respondem melhor, mas exigem mais memória.${o.models && o.models.length ? ` Modelos instalados: ${o.models.join(', ')}.` : ''}`),
      el('button', { class: 'btn', onclick: load }, 'Verificar de novo'));
  };

  const paintHistory = async () => {
    try {
      const items = await getJson('/api/ai/sessions');
      historyBox.replaceChildren(el('h2', {}, 'Sugestões anteriores'),
        items.length ? el('ul', { class: 'reqs' }, ...items.map((s) => el('li', {},
          el('div', {}, el('b', {}, `${(MODES.find((x) => x.k === s.mode) || {}).l || s.mode}${s.question ? `: ${s.question.slice(0, 80)}` : ''}`), el('span', { class: 'meta' }, `${new Date(s.createdAt).toLocaleString('pt-BR')}, ${s.model}`)),
          el('button', { class: 'btn small', onclick: () => { S.answer = s.answer; S.model = s.model; S.at = s.createdAt; S.mode = s.mode; S.history = [{ role: 'user', content: s.question || (MODES.find((x) => x.k === s.mode) || {}).l }, { role: 'assistant', content: s.answer }]; paintAnswer(); outPanel.scrollIntoView({ behavior: 'smooth' }); } }, 'Abrir')))) :
          el('p', { class: 'dim' }, 'Nenhuma sugestão gerada ainda.'));
    } catch (e) { historyBox.replaceChildren(); }
  };

  async function run(mode, question, followUp) {
    if (S.busy) return;
    S.busy = true; S.ctrl = new AbortController();
    const history = followUp ? S.history : [];
    if (!followUp) { S.answer = ''; }
    const prev = followUp ? S.answer + `\n\n---\n\n**Pergunta:** ${question}\n\n` : '';
    S.answer = prev; S.at = new Date().toISOString(); paintAnswer();
    let piece = '';
    try {
      const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: S.ctrl.signal,
        body: JSON.stringify({ mode: followUp ? 'livre' : mode, question, history, opponent: S.opponent || null, formation: S.formation || null }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'HTTP ' + r.status); }
      S.model = r.headers.get('X-AI-Model') || S.model;
      const reader = r.body.getReader(), dec = new TextDecoder();
      let last = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        piece += dec.decode(value, { stream: true });
        S.answer = prev + piece;
        if (Date.now() - last > 120) { paintAnswer(); last = Date.now(); }
      }
      const asked = followUp ? question : [(MODES.find((x) => x.k === mode) || {}).l, question].filter(Boolean).join(': ');
      S.history = [...history, { role: 'user', content: asked }, { role: 'assistant', content: piece }];
    } catch (e) {
      if (e.name !== 'AbortError') toast(e.message);
      if (!piece && !followUp) S.answer = '';
    } finally {
      S.busy = false; S.ctrl = null; paintAnswer(); paintHistory();
    }
  }

  function paintAnswer() {
    const head = el('div', { class: 'panel-head' }, el('h2', {}, S.busy ? 'Gerando sugestão…' : 'Sugestão da IA'),
      S.busy ? el('button', { class: 'btn', onclick: () => S.ctrl && S.ctrl.abort() }, 'Parar') : null);
    if (!S.answer) { outPanel.replaceChildren(head, el('p', { class: 'dim' }, S.busy ? 'A IA está lendo os dados do elenco…' : 'Escolha um tipo de análise e clique em "Gerar sugestão".')); return; }
    out.replaceChildren(renderMarkdown(S.answer));
    const follow = el('input', { type: 'text', placeholder: 'Pergunte algo sobre esta sugestão (ex.: e se o camisa 10 não puder jogar?)', 'aria-label': 'Pergunta de acompanhamento' });
    const actions = S.busy ? null : el('div', { class: 'ai-actions' },
      el('form', { class: 'ai-follow', onsubmit: (e) => { e.preventDefault(); if (follow.value.trim()) run(S.mode, follow.value.trim(), true); } }, follow, el('button', { class: 'btn', type: 'submit' }, 'Perguntar')),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(S.answer); toast('Sugestão copiada.'); } catch (e) { toast('Não foi possível copiar.'); } } }, 'Copiar'),
        el('button', { class: 'btn primary', onclick: async () => {
          const label = (MODES.find((x) => x.k === S.mode) || {}).l || 'Sugestão';
          await saveItem('reports', newId('rel'), { title: `${label} (sugestão da IA)`, type: 'Sugestão da IA', player: '', recommendation: 'Sem parecer',
            evidence: S.answer, sources: `IA local (${S.model}) com os dados do Scout Avaí em ${fmtDate((S.at || '').slice(0, 10))}. Sugestão sujeita à avaliação da comissão técnica.`, date: new Date().toLocaleDateString('pt-BR') });
          toast('Salvo em Relatórios.'); refresh && (await refresh());
        } }, 'Salvar em Relatórios')));
    outPanel.replaceChildren(head,
      el('p', { class: 'ai-disclaimer' }, `Sugestão gerada por IA local${S.model ? ` (${S.model})` : ''} a partir dos dados do sistema${S.at ? ` em ${new Date(S.at).toLocaleString('pt-BR')}` : ''}. Pode conter erros e não substitui a avaliação da comissão técnica.`),
      out, actions);
  }

  // Formulário do pedido
  const modeOf = () => MODES.find((x) => x.k === S.mode);
  const optsBox = el('div', { class: 'formgrid' });
  const paintForm = () => {
    const m = modeOf();
    const opp = el('input', { value: S.opponent || '', placeholder: 'Nome do adversário', oninput: (e) => { S.opponent = e.target.value; } });
    const form = el('input', { value: S.formation || '', placeholder: 'Ex.: 4-3-3', oninput: (e) => { S.formation = e.target.value; } });
    const note = el('textarea', { rows: '3', placeholder: m.k === 'livre' ? 'Ex.: quais atletas sub-23 merecem mais minutos?' : 'Opcional: foco, desfalques conhecidos, contexto do jogo…' });
    note.value = S.note; note.addEventListener('input', (e) => { S.note = e.target.value; });
    optsBox.replaceChildren(...[
      m.opp ? el('label', {}, 'Próximo adversário', opp) : null,
      m.form ? el('label', {}, 'Sistema tático', form) : null,
      el('label', { class: 'wide' }, m.k === 'livre' ? 'Sua pergunta' : 'Observação da comissão', note)].filter(Boolean));
  };
  const modeBtns = el('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Tipo de análise' });
  const paintModes = () => modeBtns.replaceChildren(...MODES.map((m) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(S.mode === m.k), class: 'mode' + (S.mode === m.k ? ' on' : ''),
    onclick: () => { S.mode = m.k; paintModes(); paintForm(); } }, el('b', {}, m.l), el('span', {}, m.d))));
  const ctxDetails = el('details', { class: 'ai-ctx' }, el('summary', {}, 'Ver os dados enviados à IA'));
  ctxDetails.addEventListener('toggle', async () => {
    if (!ctxDetails.open || ctxDetails.querySelector('pre')) return;
    try { const c = await getJson('/api/ai/context'); ctxDetails.append(el('pre', { class: 'ctx' }, c.text)); } catch (e) { ctxDetails.append(el('p', { class: 'dim' }, 'Não foi possível carregar.')); }
  });

  async function load() {
    try {
      status = await getJson('/api/ai/status');
      if (S.opponent == null && status.summary.nextMatch) S.opponent = status.summary.nextMatch.opponent || '';
      if (S.formation == null) S.formation = status.summary.formation || '';
      paintStatus(); paintForm();
    } catch (e) { statusBox.replaceChildren(el('p', {}, 'Não foi possível consultar o servidor.')); }
  }

  paintModes(); paintForm(); paintAnswer(); load(); paintHistory();
  root.append(
    statusBox,
    el('section', { class: 'panel' }, el('h2', {}, 'O que você quer analisar?'), modeBtns,
      el('form', { class: 'ai-ask', onsubmit: (e) => {
        e.preventDefault();
        if (!status || !status.ollama.online || !status.ollama.modelInstalled) { toast('A IA local não está pronta. Veja as instruções acima.'); return; }
        if (S.mode === 'livre' && !S.note.trim()) { toast('Escreva sua pergunta.'); return; }
        run(S.mode, S.note, false);
      } }, optsBox, el('div', {}, el('button', { class: 'btn primary', type: 'submit' }, 'Gerar sugestão'))),
      ctxDetails),
    outPanel,
    historyBox);
  return root;
}
