'use strict';
// Cruza o vínculo atleta ↔ ESPN (player_season_stats) com o cadastro oficial do clube.
//  - nome: comparado com o nome completo oficial e com o nome de exibição do clube (apelido); vale o melhor resultado.
//    "exact" (igual), "partial" (todas as palavras da ESPN estão no nome oficial), "mismatch"
//  - camisa: igual ou diferente
// Vínculo com nome exact/partial e mesma camisa deixa de precisar de revisão; qualquer divergência passa a precisar.
// O resultado fica em crossCheck, com a origem do dado oficial usado.
const STOP = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
const tokens = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z ]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));

function nameMatch(providerName, officialFullName) {
  const a = tokens(providerName), b = tokens(officialFullName);
  if (!a.length || !b.length) return null;
  if (a.join(' ') === b.join(' ')) return 'exact';
  return a.every((t) => b.includes(t)) ? 'partial' : 'mismatch';
}

async function crossCheckEspn({ db, now = new Date(), dryRun = false, provider = 'espn_deportes' } = {}) {
  const iso = now.toISOString();
  const stats = await db.collection('player_season_stats').find({ provider }).toArray();
  const players = await db.collection('players').find({ clubId: 'club-avai' }).toArray();
  const byId = new Map(players.map((p) => [p._id, p]));
  const results = [];
  for (const s of stats) {
    const p = byId.get(s.playerId), m = s.match || {};
    if (!p || !p.fullName || !(p.fieldSources && p.fieldSources.fullName)) continue; // sem nome oficial, nada a cruzar
    const RANK = { exact: 2, partial: 1, mismatch: 0 };
    const cands = [['fullName', nameMatch(m.espnName, p.fullName)], ['name', nameMatch(m.espnName, p.name)]].filter((c) => c[1]);
    const best = cands.sort((x, y) => RANK[y[1]] - RANK[x[1]])[0] || [null, null];
    const name = best[1];
    const shirt = m.espnShirt == null || p.shirtNumber == null ? null : m.espnShirt === p.shirtNumber;
    const ok = (name === 'exact' || name === 'partial') && shirt !== false;
    const crossCheck = { checkedAt: iso, officialSourceId: p.fieldSources.fullName.sourceId, officialFullName: p.fullName, providerName: m.espnName || null,
      nameMatch: name, nameComparedWith: best[0], officialName: p.name || null, officialShirt: p.shirtNumber, providerShirt: m.espnShirt == null ? null : m.espnShirt, shirtMatch: shirt, needsReview: !ok };
    results.push({ statId: s._id, playerId: p._id, before: !!s.needsReview, after: !ok, crossCheck });
    if (!dryRun) await db.collection('player_season_stats').updateOne({ _id: s._id }, { $set: { needsReview: !ok, crossCheck } });
  }
  return results;
}

module.exports = { crossCheckEspn, nameMatch };
