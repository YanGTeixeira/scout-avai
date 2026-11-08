'use strict';
// Validação dos widgets do SofaScore.
// O usuário cola o código do iframe (ou só o link) copiado no site do SofaScore.
// Guardamos apenas um link https de widgets.sofascore.com, reescrito a partir da URL
// interpretada: nenhum HTML colado é armazenado ou devolvido à interface.

const ALLOWED_HOSTS = ['widgets.sofascore.com'];
const ENTITY_TYPES = ['player', 'club', 'competition', 'match'];
const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 2000;

// Tipo de objeto do SofaScore citado no caminho do widget → tipo de entidade da nossa base.
const REF_KINDS = { player: 'player', team: 'club', 'unique-tournament': 'competition', tournament: 'competition', event: 'match' };

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Lê o src e a altura de um <iframe> colado, ou aceita um link direto.
function extractEmbed(input) {
  const raw = String(input || '').trim();
  if (!raw) return { error: 'Cole o código do iframe ou o link do widget.' };
  if (raw.length > 5000) return { error: 'Conteúdo grande demais para um widget.' };
  let src = raw, height = null;
  if (/<iframe/i.test(raw)) {
    const m = raw.match(/\ssrc\s*=\s*(["'])(.*?)\1/i);
    if (!m) return { error: 'Não encontrei o atributo src no iframe colado.' };
    src = decodeEntities(m[2].trim());
    const h = raw.match(/\sheight\s*=\s*(["']?)(\d{2,4})(?:px)?\1/i) || raw.match(/height\s*:\s*(\d{2,4})px/i);
    if (h) height = Number(h[h.length - 1]);
  }
  return { src, height };
}

function sofascoreRef(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    const kind = REF_KINDS[parts[i]];
    if (kind && /^\d+$/.test(parts[i + 1])) return { kind: parts[i], entityType: kind, id: parts[i + 1] };
  }
  const id = url.searchParams.get('id');
  if (id && /^\d+$/.test(id)) return { kind: 'event', entityType: 'match', id }; // widgets de partida usam ?id=
  return null;
}

// Devolve { value } pronto para gravar, ou { error } com mensagem para a interface.
function parseWidget(body) {
  const b = body || {};
  if (!ENTITY_TYPES.includes(b.entityType)) return { error: 'entityType inválido.' };
  if (typeof b.entityId !== 'string' || !b.entityId || b.entityId.length > 120) return { error: 'entityId inválido.' };
  const e = extractEmbed(b.embed);
  if (e.error) return e;
  let url;
  try { url = new URL(e.src); } catch (err) { return { error: 'O link do widget não é uma URL válida.' }; }
  if (url.protocol !== 'https:') return { error: 'O widget precisa usar https.' };
  if (!ALLOWED_HOSTS.includes(url.hostname)) return { error: `Só são aceitos widgets de ${ALLOWED_HOSTS.join(', ')}. Use o botão de incorporar do SofaScore.` };
  if (url.username || url.password) return { error: 'Link de widget inválido.' };
  let height = Number(b.height) || e.height || DEFAULT_HEIGHT;
  height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)));
  const title = String(b.title || '').trim().slice(0, 120) || null;
  return { value: { entityType: b.entityType, entityId: b.entityId, src: url.href, height, title, sofascoreRef: sofascoreRef(url) } };
}

module.exports = { parseWidget, extractEmbed, sofascoreRef, ALLOWED_HOSTS, ENTITY_TYPES };
