'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWidget } = require('../lib/sofascore-widget');

const base = { entityType: 'player', entityId: 'avai-pro-kaua-santos' };

test('aceita iframe colado e extrai src, altura e ID do atleta', () => {
  const r = parseWidget({ ...base, embed: '<iframe id="sofa-player-embed-971037" width="100%" height="568" style="display:block;max-width:400px" src="https://widgets.sofascore.com/pt-BR/embed/player/971037?widgetTheme=light&amp;x=1" frameborder="0" scrolling="no"></iframe>' });
  assert.equal(r.error, undefined);
  assert.equal(r.value.src, 'https://widgets.sofascore.com/pt-BR/embed/player/971037?widgetTheme=light&x=1');
  assert.equal(r.value.height, 568);
  assert.deepEqual(r.value.sofascoreRef, { kind: 'player', entityType: 'player', id: '971037' });
});

test('aceita link direto e usa altura padrão', () => {
  const r = parseWidget({ ...base, entityType: 'competition', entityId: 'comp-serie-b', embed: 'https://widgets.sofascore.com/embed/unique-tournament/390/season/72603/standings/Serie%20B' });
  assert.equal(r.value.height, 420);
  assert.equal(r.value.sofascoreRef.entityType, 'competition');
  assert.equal(r.value.sofascoreRef.id, '390');
});

test('widget de partida com ?id= vira referência de partida', () => {
  const r = parseWidget({ ...base, entityType: 'match', entityId: 'm1', embed: 'https://widgets.sofascore.com/embed/lineups?id=12345678&widgetTheme=dark' });
  assert.deepEqual(r.value.sofascoreRef, { kind: 'event', entityType: 'match', id: '12345678' });
});

test('recusa outros domínios, http e esquemas perigosos', () => {
  for (const embed of [
    'https://evil.example.com/embed/player/1',
    'https://widgets.sofascore.com.evil.example/embed',
    'http://widgets.sofascore.com/embed/player/1',
    'javascript:alert(1)',
    '<iframe src="https://www.sofascore.com/api/v1/player/1"></iframe>',
    'https://user:pw@widgets.sofascore.com/embed/player/1',
  ]) assert.ok(parseWidget({ ...base, embed }).error, embed);
});

test('recusa entrada vazia, iframe sem src e entidade inválida', () => {
  assert.ok(parseWidget({ ...base, embed: '' }).error);
  assert.ok(parseWidget({ ...base, embed: '<iframe height="300"></iframe>' }).error);
  assert.ok(parseWidget({ ...base, entityType: 'stadium', embed: 'https://widgets.sofascore.com/x' }).error);
  assert.ok(parseWidget({ entityType: 'player', embed: 'https://widgets.sofascore.com/x' }).error);
});

test('limita altura e título', () => {
  const r = parseWidget({ ...base, embed: 'https://widgets.sofascore.com/x', height: 99999, title: 'a'.repeat(500) });
  assert.equal(r.value.height, 2000);
  assert.equal(r.value.title.length, 120);
  assert.equal(parseWidget({ ...base, embed: 'https://widgets.sofascore.com/x', height: 5 }).value.height, 120);
});
