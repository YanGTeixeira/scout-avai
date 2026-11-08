'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { memdb } = require('./helpers/memdb');
const { buildTeamContext } = require('../lib/ai/context');
const { buildMessages, MODES } = require('../lib/ai/prompts');
const ollama = require('../lib/ai/ollama');

const seed = () => ({
  players: [
    { _id: 'p1', clubId: 'club-avai', category: 'profissional', squadStatus: 'listed_on_official_page', name: 'Igor Bohn', shirtNumber: 1, positionGroup: 'GK', positionLabel: 'Goleiro', birthDate: '1996-02-05', heightCm: 193 },
    { _id: 'p2', clubId: 'club-avai', category: 'profissional', squadStatus: 'listed_on_official_page', name: 'Jean Lucas', shirtNumber: 10, positionGroup: 'MF', positionLabel: 'Meio-campo', birthDate: '1995-06-22', heightCm: 180 },
    { _id: 'p3', clubId: 'club-avai', category: 'profissional', squadStatus: 'not_listed_on_official_page', name: 'Saiu', positionGroup: 'FW' },
    { _id: 'p4', clubId: 'club-avai', category: 'sub-20', squadStatus: 'manual_entry', name: 'Base', positionGroup: 'FW' },
  ],
  player_season_stats: [
    { _id: 's2', playerId: 'p2', competitionId: 'comp-serie-b', seasonId: 'season-serie-b-2026', asOf: '2026-11-07', stats: { appearances: 34, startsDerived: 31, substituteAppearances: 3, goals: 3, assists: 6 } },
    { _id: 's1', playerId: 'p1', competitionId: 'comp-serie-b', seasonId: 'season-serie-b-2026', asOf: '2026-11-07', needsReview: true, stats: { appearances: 8, startsDerived: 8, saves: 20, goalsConceded: 9 } },
  ],
  tactical_profiles: [{ _id: 'avai-current', formation: '4-3-3', pressing: 'Alta', modelText: 'Pressão após perda.', roles: [{ position: 'Lateral', requirement: 'Apoio por dentro' }] }],
  clubs: [{ _id: 'club-avai', shortName: 'Avaí' }, { _id: 'club-x', shortName: 'Rival FC' }],
  matches: [{ _id: 'm1', homeClubId: 'club-x', awayClubId: 'club-avai', date: '2026-11-14', round: 38, status: 'scheduled' },
    { _id: 'm0', homeClubId: 'club-avai', awayClubId: 'club-x', date: '2026-10-01', round: 30, status: 'finished', score: { home: 2, away: 1 } }],
  market_targets: [{ _id: 'a1', name: 'Fulano', clubName: 'Criciúma', position: 'Lateral', priority: 'Alta', stage: 'Observação' }],
  scouting_reports: [],
});

test('contexto traz só o elenco atual, com dados, modelo de jogo, jogos e limitações', async () => {
  const ctx = await buildTeamContext(memdb(seed()), { now: new Date('2026-11-08T12:00:00Z') });
  assert.equal(ctx.summary.players, 2);
  assert.match(ctx.text, /10 \| Jean Lucas \| Meio-campo \| 31 \| 180 \| — \| 34 \| 31 \| 3 \| 3 \| 6/);
  assert.match(ctx.text, /Igor Bohn \(vínculo com a fonte a conferir\)/);
  assert.doesNotMatch(ctx.text, /Saiu|Base/);
  assert.match(ctx.text, /Formação base: 4-3-3/);
  assert.match(ctx.text, /Requisito para Lateral: Apoio por dentro/);
  assert.match(ctx.text, /Rodada 38, 2026-11-14: Rival FC x Avaí \(agendado\)/);
  assert.match(ctx.text, /Fulano \(Criciúma, Lateral\)/);
  assert.match(ctx.text, /Não há minutos jogados/);
  assert.deepEqual(ctx.summary.nextMatch, { date: '2026-11-14', opponent: 'Rival FC', home: false });
  assert.equal(ctx.summary.formation, '4-3-3');
});

test('mensagens: sistema com dados, histórico e tarefa do modo', async () => {
  const ctx = await buildTeamContext(memdb(seed()), { now: new Date('2026-11-08T12:00:00Z') });
  const msgs = buildMessages({ mode: 'escalacao', question: 'Jean Lucas suspenso', history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'system', content: 'ignorar' }], context: ctx });
  assert.equal(msgs[0].role, 'system');
  assert.match(msgs[0].content, /<dados>[\s\S]*Jean Lucas[\s\S]*<\/dados>/);
  assert.match(msgs[0].content, /sugestão para a comissão técnica/);
  assert.equal(msgs.length, 4, 'histórico com papel inválido é descartado');
  assert.match(msgs[3].content, /sistema 4-3-3/);
  assert.match(msgs[3].content, /contra Rival FC/);
  assert.match(msgs[3].content, /Observação da comissão: Jean Lucas suspenso/);
  for (const k of Object.keys(MODES)) assert.ok(buildMessages({ mode: k, question: 'x', context: ctx }).length >= 2);
});

function fakeFetch(lines, status = 200) {
  const enc = new TextEncoder();
  return async (url, opts) => {
    fakeFetch.last = { url, body: opts && opts.body ? JSON.parse(opts.body) : null };
    if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'qwen2.5:7b' }] }) };
    const chunks = lines.map((l) => enc.encode(l));
    return { ok: status === 200, status, text: async () => 'falhou', body: (async function* () { for (const c of chunks) yield c; })() };
  };
}

test('ollama: junta o streaming NDJSON, mesmo com linha partida entre pedaços', async () => {
  const f = fakeFetch(['{"message":{"content":"Olá"},"done":false}\n{"message":{"con', 'tent":", comissão"},"done":false}\n', '{"done":true}\n']);
  let text = '';
  for await (const p of ollama.chat([{ role: 'user', content: 'oi' }], { fetchImpl: f })) text += p;
  assert.equal(text, 'Olá, comissão');
  assert.equal(fakeFetch.last.body.stream, true);
  assert.equal(fakeFetch.last.body.model, ollama.MODEL);
});

test('ollama: erro HTTP e erro no meio do streaming viram exceção', async () => {
  await assert.rejects(async () => { for await (const _ of ollama.chat([], { fetchImpl: fakeFetch([], 404) })); }, /HTTP 404/);
  await assert.rejects(async () => { for await (const _ of ollama.chat([], { fetchImpl: fakeFetch(['{"error":"model not found"}\n']) })); }, /model not found/);
});

test('ollama: status reconhece modelo instalado e servidor desligado', async () => {
  const on = await ollama.status({ fetchImpl: fakeFetch([]) });
  assert.equal(on.online, true); assert.equal(on.modelInstalled, true);
  const off = await ollama.status({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  assert.equal(off.online, false);
});
