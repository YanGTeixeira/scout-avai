'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { memdb } = require('./helpers/memdb');
const { crossCheckEspn, nameMatch } = require('../lib/crosscheck/espn-vs-club');

test('nameMatch', () => {
  assert.equal(nameMatch('Kauã Gabriel Pereira Dos Santos', 'Kauã Gabriel Pereira dos Santos'), 'exact');
  assert.equal(nameMatch('Léo Chú', 'Leonardo Alves Chú Franco'), 'mismatch');
  assert.equal(nameMatch('Gabriel Simples', 'Gabriel Pereira Simples'), 'partial');
  assert.equal(nameMatch('Pedro Henrique Franklim Martins', 'Pedro Henrique Franklim Da Silva'), 'mismatch');
  assert.equal(nameMatch('', 'X'), null);
});

const src = { sourceId: 'src-avai-site-api' };
const P = (id, fullName, shirt, name) => ({ _id: id, clubId: 'club-avai', name: name || fullName, fullName, shirtNumber: shirt, fieldSources: { fullName: src } });
const S = (id, pid, espnName, espnShirt, needsReview) => ({ _id: id, playerId: pid, provider: 'espn_deportes', needsReview, match: { espnName, espnShirt } });

test('confirma vínculos que batem e sinaliza divergências', async () => {
  const db = memdb({
    players: [P('a', 'Kauã Gabriel Pereira dos Santos', 30), P('b', 'Caio Suassuna Gonçalves Ferreira', 16), P('c', 'Pedro Henrique Franklim Da Silva', 35, 'Pedrão'), P('e', 'Leonardo Alves Chú Franco', 7, 'Léo Chú'),
      { _id: 'd', clubId: 'club-avai', fullName: null, shirtNumber: 9 }],
    player_season_stats: [S('sa', 'a', 'Kauã Gabriel Pereira Dos Santos', 30, true), S('sb', 'b', 'Caio Suassuna', 19, false),
      S('sc', 'c', 'Pedro Henrique Franklim Martins', 35, false), S('sd', 'd', 'Fulano', 9, true), S('se', 'e', 'Léo Chú', 7, false)],
  });
  const r = await crossCheckEspn({ db });
  const st = (id) => db.data.player_season_stats.find((s) => s._id === id);
  assert.equal(st('sa').needsReview, false);
  assert.equal(st('sb').needsReview, true);
  assert.equal(st('sb').crossCheck.shirtMatch, false);
  assert.equal(st('sc').needsReview, true);
  assert.equal(st('sc').crossCheck.nameMatch, 'mismatch');
  assert.equal(st('sd').needsReview, true, 'sem nome oficial não mexe');
  assert.equal(st('sd').crossCheck, undefined);
  assert.equal(st('se').needsReview, false, 'apelido igual ao nome de exibição do clube');
  assert.equal(st('se').crossCheck.nameComparedWith, 'name');
  assert.equal(r.length, 4);
});
