'use strict';
// Sincroniza o elenco profissional com o site oficial do Avaí (API WordPress pública).
// Regras:
//  - Cada campo guarda de onde veio (fieldSources). O site só sobrescreve campo vazio ou campo que ele mesmo gravou.
//    Se outra fonte já preencheu o campo com valor diferente, o valor atual fica e a divergência vai para field_conflicts.
//  - Valor vazio no site nunca apaga valor existente.
//  - Atleta que some da página não é apagado: vira squadStatus "not_listed_on_official_page" com delistedAt.
//  - Resposta idêntica à anterior (mesmo hash) não é reprocessada.
//  - Cada execução fica registrada em sync_runs, com a lista de alterações (histórico).
const crypto = require('crypto');
const { normalizePlayer } = require('./normalize');

const BASE = 'https://avai.com.br/wp-json/wp/v2';
const SOURCE_ID = 'src-avai-site-api';
const SAME_PUBLISHER = ['src-avai-elenco']; // carga inicial feita a partir da mesma página do clube
const CLUB_ID = 'club-avai';
const RAW_ID = 'avai-site:elenco-profissional';
const MIN_EXPECTED = 15; // abaixo disso a resposta é tratada como quebrada (evita "desligar" o elenco inteiro)
const FIELDS = ['name', 'fullName', 'shirtNumber', 'birthDate', 'birthPlace', 'heightCm', 'weightKg', 'positionLabel', 'positionGroup'];
const FIELDS_PATH = '_fields=id,slug,link,modified_gmt,title,meta,categoria-do-jogador';

const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
const hash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

async function fetchAll(fetchJson, path) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetchJson(`${BASE}/${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(r.body)) throw new Error(`Resposta inesperada em ${path}`);
    out.push(...r.body);
    const total = Number(r.headers && r.headers.get ? r.headers.get('x-wp-totalpages') : 1) || 1;
    if (page >= total) break;
  }
  return out;
}

function completeness(p) {
  return {
    identity: p.fullName && p.birthDate ? 'complete' : 'partial',
    physical: p.heightCm != null && p.weightKg != null ? 'complete' : (p.heightCm != null || p.weightKg != null ? 'partial' : 'missing'),
    contract: (p.dataCompleteness && p.dataCompleteness.contract) || 'missing',
    statistics: (p.dataCompleteness && p.dataCompleteness.statistics) || 'missing',
  };
}

// Calcula o que mudar num atleta existente. Não grava nada.
function planUpdate(doc, n, ref) {
  const set = {}, changes = [], conflicts = [];
  const sources = doc.fieldSources || {};
  for (const f of FIELDS) {
    const next = n[f], cur = doc[f];
    if (next == null) continue;
    const owner = sources[f] && sources[f].sourceId;
    if (same(next, cur)) {
      if (owner !== SOURCE_ID) set[`fieldSources.${f}`] = ref; // confirma a origem
      continue;
    }
    if (cur == null || owner === SOURCE_ID || (!owner && SAME_PUBLISHER.some((s) => (doc.sourceRefs || []).some((r) => r.sourceId === s)) && ['name', 'shirtNumber', 'positionLabel', 'positionGroup'].includes(f))) {
      set[f] = next;
      set[`fieldSources.${f}`] = ref;
      changes.push({ playerId: doc._id, field: f, from: cur == null ? null : cur, to: next });
    } else {
      conflicts.push({ playerId: doc._id, field: f, current: { value: cur, sourceId: owner || 'desconhecida' }, proposed: { value: next, sourceId: SOURCE_ID } });
    }
  }
  if (set.positionLabel !== undefined) set.positions = [{ label: n.positionLabel, group: n.positionGroup, isPrimary: true, sourceId: SOURCE_ID }];
  return { set, changes, conflicts };
}

async function syncAvaiSquad({ db, fetchJson, now = new Date(), dryRun = false, force = false } = {}) {
  const iso = now.toISOString();
  const day = iso.slice(0, 10);
  const run = { _id: `avai-site-${iso}-${crypto.randomBytes(3).toString('hex')}`, source: SOURCE_ID, startedAt: iso, dryRun, status: 'running', counts: {}, changes: [], conflicts: [] };
  try {
    const categories = await fetchAll(fetchJson, 'categoria-do-jogador?_fields=id,name,slug');
    const list = await fetchAll(fetchJson, `elenco-profissional?${FIELDS_PATH}`);
    const contentHash = hash({ categories, list });
    run.contentHash = contentHash;
    run.counts.fetched = list.length;

    const prevRaw = await db.collection('raw_payloads').findOne({ _id: RAW_ID });
    if (prevRaw && prevRaw.contentHash === contentHash && !force) {
      run.status = 'unchanged';
      return await finish(db, run, dryRun);
    }
    if (list.length < MIN_EXPECTED) throw new Error(`Só ${list.length} atletas na resposta (mínimo esperado ${MIN_EXPECTED}); nada foi alterado.`);

    const players = list.map((e) => normalizePlayer(e, categories));
    const existing = await db.collection('players').find({ clubId: CLUB_ID }).toArray();
    const bySlug = new Map(existing.filter((d) => d.externalIds && d.externalIds.avaiSite).map((d) => [d.externalIds.avaiSite, d]));
    const seen = new Set();
    const ops = [];
    let created = 0, updated = 0, unchanged = 0, relisted = 0;

    for (const n of players) {
      seen.add(n.slug);
      const ref = { sourceId: SOURCE_ID, url: n.url, collectedAt: iso, status: 'confirmed' };
      const srcRef = { sourceId: SOURCE_ID, url: n.url, collectedAt: day };
      const doc = bySlug.get(n.slug) || existing.find((d) => !(d.externalIds && d.externalIds.avaiSite) && d.slug === n.slug);
      if (!doc) {
        const id = 'avai-pro-' + n.slug;
        const fieldSources = Object.fromEntries(FIELDS.filter((f) => n[f] != null).map((f) => [f, ref]));
        const fresh = { _id: id, clubId: CLUB_ID, slug: n.slug, category: 'profissional', squadStatus: 'listed_on_official_page',
          name: n.name, fullName: n.fullName, shirtNumber: n.shirtNumber, birthDate: n.birthDate, birthPlace: n.birthPlace,
          heightCm: n.heightCm, weightKg: n.weightKg, positionLabel: n.positionLabel, positionGroup: n.positionGroup,
          positions: n.positionLabel ? [{ label: n.positionLabel, group: n.positionGroup, isPrimary: true, sourceId: SOURCE_ID }] : [],
          nationality: null, preferredFoot: null, contract: null, statistics: [],
          externalIds: { avaiSite: n.slug, avaiSiteWpId: n.wpId }, fieldSources, sourceRefs: [srcRef], lastVerifiedAt: day, createdAt: iso, updatedAt: iso };
        fresh.dataCompleteness = completeness(fresh);
        ops.push(['insert', fresh]);
        run.changes.push({ playerId: id, field: '*', from: null, to: 'novo atleta no elenco' });
        created++;
        continue;
      }
      const { set, changes, conflicts } = planUpdate(doc, n, ref);
      run.changes.push(...changes);
      run.conflicts.push(...conflicts);
      const wasDelisted = doc.squadStatus === 'not_listed_on_official_page';
      if (wasDelisted) { relisted++; run.changes.push({ playerId: doc._id, field: 'squadStatus', from: doc.squadStatus, to: 'listed_on_official_page' }); }
      const merged = Object.assign({}, doc, Object.fromEntries(Object.entries(set).filter(([k]) => !k.includes('.'))));
      Object.assign(set, {
        squadStatus: 'listed_on_official_page', 'externalIds.avaiSite': n.slug, 'externalIds.avaiSiteWpId': n.wpId,
        sourceRefs: [...(doc.sourceRefs || []).filter((r) => r.sourceId !== SOURCE_ID), srcRef],
        lastVerifiedAt: day, dataCompleteness: completeness(merged),
      });
      if (changes.length || wasDelisted) { set.updatedAt = iso; updated++; } else unchanged++;
      if (!doc.externalIds || typeof doc.externalIds !== 'object') { delete set['externalIds.avaiSite']; delete set['externalIds.avaiSiteWpId']; set.externalIds = { avaiSite: n.slug, avaiSiteWpId: n.wpId }; }
      ops.push(['update', doc._id, { $set: set, $unset: { delistedAt: '' } }]);
    }

    let delisted = 0;
    for (const d of existing) {
      const s = d.externalIds && d.externalIds.avaiSite;
      if (!s || seen.has(s) || d.category !== 'profissional' || d.squadStatus === 'not_listed_on_official_page') continue;
      ops.push(['update', d._id, { $set: { squadStatus: 'not_listed_on_official_page', delistedAt: iso, updatedAt: iso } }]);
      run.changes.push({ playerId: d._id, field: 'squadStatus', from: d.squadStatus || null, to: 'not_listed_on_official_page' });
      delisted++;
    }

    Object.assign(run.counts, { created, updated, unchanged, relisted, delisted, conflicts: run.conflicts.length });
    run.status = 'ok';
    if (!dryRun) {
      const col = db.collection('players');
      for (const op of ops) {
        if (op[0] === 'insert') await col.insertOne(op[1]);
        else await col.updateOne({ _id: op[1] }, op[2]);
      }
      for (const c of run.conflicts) {
        await db.collection('field_conflicts').updateOne({ _id: `player:${c.playerId}:${c.field}:${SOURCE_ID}` },
          { $set: { entityType: 'player', entityId: c.playerId, field: c.field, current: c.current, proposed: Object.assign({ collectedAt: iso }, c.proposed), status: 'open', updatedAt: iso },
            $setOnInsert: { createdAt: iso } }, { upsert: true });
      }
      await db.collection('raw_payloads').updateOne({ _id: RAW_ID }, { $set: { provider: 'avai_site', endpoint: `${BASE}/elenco-profissional`, fetchedAt: iso, contentHash, body: { categories, list } } }, { upsert: true });
      await db.collection('sources').updateOne({ _id: SOURCE_ID }, { $set: { name: 'Avaí F.C. — site oficial (API WordPress do elenco profissional)', type: 'official_club', url: `${BASE}/elenco-profissional`,
        publisher: 'Avaí Futebol Clube', reliability: 'high', scope: 'Nome, número, posição, nome completo, nascimento, naturalidade, altura e peso do elenco profissional publicado pelo clube.',
        usedInLoad: true, collectedAt: day } }, { upsert: true });
    }
    return await finish(db, run, dryRun);
  } catch (e) {
    if (!run.finishedAt) { // falha antes de registrar a execução
      run.status = 'error';
      run.error = e.message;
      await finish(db, run, dryRun).catch(() => {});
    }
    throw e;
  }
}

async function finish(db, run, dryRun) {
  run.finishedAt = new Date().toISOString();
  if (!dryRun && db) await db.collection('sync_runs').insertOne(run);
  return run;
}

module.exports = { syncAvaiSquad, planUpdate, SOURCE_ID, FIELDS };
