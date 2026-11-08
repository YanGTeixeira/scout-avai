'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./fixtures/avai-site-elenco.json');
const { memdb } = require('./helpers/memdb');
const N = require('../lib/avai-site/normalize');
const { syncAvaiSquad, SOURCE_ID } = require('../lib/avai-site/sync');

test('parsers aceitam as variações reais do site', () => {
  assert.equal(N.parseHeightCm('1,65'), 165);
  assert.equal(N.parseHeightCm('1.93'), 193);
  assert.equal(N.parseHeightCm('175'), 175);
  assert.equal(N.parseHeightCm(''), null);
  assert.equal(N.parseHeightCm('9,99'), null);
  assert.equal(N.parseWeightKg('62 Kg'), 62);
  assert.equal(N.parseWeightKg('62,8 kg'), 62.8);
  assert.equal(N.parseWeightKg('88.9'), 88.9);
  assert.equal(N.parseWeightKg(''), null);
  assert.equal(N.parseBirthDate('23/11/2006'), '2006-11-23');
  assert.equal(N.parseBirthDate('31/02/2000'), null);
  assert.equal(N.parseBirthDate('2000-01-01'), null);
  assert.deepEqual(N.parseBirthPlace('Junqueirópolis_SP'), { raw: 'Junqueirópolis_SP', city: 'Junqueirópolis', state: 'SP' });
  assert.deepEqual(N.parseBirthPlace('Rio de Janeiro-RJ'), { raw: 'Rio de Janeiro-RJ', city: 'Rio de Janeiro', state: 'RJ' });
  assert.deepEqual(N.parseBirthPlace('Bom Retiro do Sul'), { raw: 'Bom Retiro do Sul', city: 'Bom Retiro do Sul', state: null });
  assert.equal(N.decodeHtml('Avaí &#8212; F.C. &amp; <b>x</b>'), 'Avaí — F.C. & x');
});

test('normaliza um atleta real', () => {
  const k = N.normalizePlayer(fx.players.find((p) => p.slug === 'kaua-santos'), fx.categories);
  assert.equal(k.name, 'Kauã Santos');
  assert.equal(k.fullName, 'Kauã Gabriel Pereira dos Santos');
  assert.equal(k.shirtNumber, 30);
  assert.equal(k.birthDate, '2006-11-23');
  assert.equal(k.heightCm, 165);
  assert.equal(k.weightKg, 62);
  assert.equal(k.positionLabel, 'Meio-campo');
  assert.equal(k.positionGroup, 'MF');
});

// Simula a API: devolve a fixture com N cópias (para passar do mínimo de 15 atletas).
function fakeApi(players, categories = fx.categories) {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    const headers = { get: (h) => (h === 'x-wp-totalpages' ? '1' : null) };
    return { status: 200, headers, body: /\/v2\/categoria-do-jogador/.test(url) ? categories : players };
  };
  fetchJson.calls = calls;
  return fetchJson;
}
const filler = (n) => Array.from({ length: n }, (_, i) => ({ id: 900000 + i, slug: `extra-${i}`, link: `https://avai.com.br/elenco-profissional/extra-${i}/`, modified_gmt: '2026-10-01T00:00:00',
  title: { rendered: `Extra ${i}` }, meta: { numero: String(60 + i), 'nome-completo': `Extra ${i}`, nascimento: '01/01/2000', altura: '1.80', peso: '75', naturalidade: 'Florianópolis-SC' }, 'categoria-do-jogador': [33] }));

const seedPlayers = () => [
  { _id: 'avai-pro-kaua-santos', clubId: 'club-avai', slug: 'kaua-santos', category: 'profissional', name: 'Kauã Santos', shirtNumber: 30, positionLabel: 'Meio-campo', positionGroup: 'MF',
    birthDate: null, heightCm: null, squadStatus: 'listed_on_official_page', externalIds: { avaiSite: 'kaua-santos', espn: '3094290' }, sourceRefs: [{ sourceId: 'src-avai-elenco' }] },
  { _id: 'avai-pro-igor-bohn', clubId: 'club-avai', slug: 'igor-bohn', category: 'profissional', name: 'Igor Bohn', shirtNumber: 99, positionLabel: 'Goleiro', positionGroup: 'GK',
    birthDate: '1990-01-01', heightCm: null, squadStatus: 'listed_on_official_page', externalIds: { avaiSite: 'igor-bohn' }, sourceRefs: [{ sourceId: 'src-avai-elenco' }] },
  { _id: 'avai-pro-saiu', clubId: 'club-avai', slug: 'saiu', category: 'profissional', name: 'Saiu', squadStatus: 'listed_on_official_page', externalIds: { avaiSite: 'saiu' }, sourceRefs: [] },
];

test('sincroniza: preenche vazios, registra divergência, marca saídas e cria novos', async () => {
  const db = memdb({ players: seedPlayers() });
  const api = fakeApi([...fx.players, ...filler(15)]);
  const run = await syncAvaiSquad({ db, fetchJson: api, now: new Date('2026-11-08T10:00:00Z') });
  assert.equal(run.status, 'ok');
  const P = (id) => db.data.players.find((p) => p._id === id);

  const k = P('avai-pro-kaua-santos');
  assert.equal(k.fullName, 'Kauã Gabriel Pereira dos Santos');
  assert.equal(k.birthDate, '2006-11-23');
  assert.equal(k.fieldSources.birthDate.sourceId, SOURCE_ID);
  assert.equal(k.externalIds.espn, '3094290', 'não apaga outros IDs externos');
  assert.equal(k.externalIds.avaiSiteWpId, 209180);
  assert.equal(k.dataCompleteness.identity, 'complete');

  const i = P('avai-pro-igor-bohn');
  assert.equal(i.shirtNumber, 1, 'camisa vinda da mesma página do clube é atualizada');
  assert.equal(i.birthDate, '1990-01-01', 'valor de outra origem não é sobrescrito');
  assert.equal(db.data.field_conflicts.length, 1);
  assert.equal(db.data.field_conflicts[0].field, 'birthDate');
  assert.equal(db.data.field_conflicts[0].proposed.value, '1996-02-05');

  assert.equal(P('avai-pro-saiu').squadStatus, 'not_listed_on_official_page');
  assert.ok(P('avai-pro-saiu').delistedAt);
  assert.ok(P('avai-pro-filipinho'), 'atleta novo é criado');
  assert.equal(P('avai-pro-filipinho').fieldSources.name.sourceId, SOURCE_ID);
  assert.equal(run.counts.delisted, 1);
  assert.equal(run.counts.created, 16);
  assert.equal(db.data.sync_runs.length, 1);
  assert.ok(db.data.raw_payloads[0].contentHash);
});

test('não reprocessa quando o site não mudou e reprocessa com force', async () => {
  const db = memdb({ players: seedPlayers() });
  const players = [...fx.players, ...filler(15)];
  await syncAvaiSquad({ db, fetchJson: fakeApi(players) });
  const again = await syncAvaiSquad({ db, fetchJson: fakeApi(players) });
  assert.equal(again.status, 'unchanged');
  const forced = await syncAvaiSquad({ db, fetchJson: fakeApi(players), force: true });
  assert.equal(forced.status, 'ok');
  assert.equal(forced.counts.created, 0);
  assert.equal(forced.changes.length, 0, 'segunda passada não gera alterações');
});

test('resposta pequena demais aborta sem alterar nada', async () => {
  const db = memdb({ players: seedPlayers() });
  await assert.rejects(syncAvaiSquad({ db, fetchJson: fakeApi(fx.players) }), /mínimo esperado/);
  assert.equal(db.data.players.find((p) => p._id === 'avai-pro-saiu').squadStatus, 'listed_on_official_page');
  assert.equal(db.data.sync_runs[0].status, 'error');
});

test('dry-run não grava', async () => {
  const db = memdb({ players: seedPlayers() });
  const run = await syncAvaiSquad({ db, fetchJson: fakeApi([...fx.players, ...filler(15)]), dryRun: true });
  assert.equal(run.status, 'ok');
  assert.ok(run.changes.length > 0);
  assert.equal(db.data.players.length, 3);
  assert.equal((db.data.sync_runs || []).length, 0);
});

test('atleta que volta à página perde a marca de saída', async () => {
  const seed = seedPlayers();
  seed[0].squadStatus = 'not_listed_on_official_page'; seed[0].delistedAt = '2026-10-01T00:00:00Z';
  const db = memdb({ players: seed });
  const run = await syncAvaiSquad({ db, fetchJson: fakeApi([...fx.players, ...filler(15)]) });
  const k = db.data.players.find((p) => p._id === 'avai-pro-kaua-santos');
  assert.equal(k.squadStatus, 'listed_on_official_page');
  assert.equal(k.delistedAt, undefined);
  assert.equal(run.counts.relisted, 1);
});
