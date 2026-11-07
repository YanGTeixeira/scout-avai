'use strict';
// Servidor local do Scout Avaí: serve public/index.html e conecta a interface ao MongoDB.
// Compatível com Node 12+ (sem ?. nem ??). Uso: MONGODB_URI=... node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // só a sua máquina; não há autenticação
const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB || 'scout_avai';
const PUBLIC = path.join(__dirname, 'public');
const CLUB_ID = 'club-avai';
const MANUAL_SRC = 'src-manual-ui';
let db;

const today = () => new Date().toISOString().slice(0, 10);
const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
const nz = v => (v === '' || v === undefined) ? null : v;
const GROUP = { Goleiro: 'GK', Zagueiro: 'CB', Lateral: 'FB', Volante: 'DM', Meia: 'MF', 'Meio-campo': 'MF', Ponta: 'FW', Centroavante: 'FW', Atacante: 'FW' };
const CAT = { profissional: 'Profissional', 'sub-20': 'Sub-20', 'sub-17': 'Sub-17', 'sub-15': 'Sub-15', historico: 'Histórico' };

// Cada entrada: coleção, ordenação, banco→interface (toUI) e interface→banco (fromUI).
// fromUI devolve { set, soi }: set é sempre atualizado; soi ($setOnInsert) só na criação.
const MAPS = {
  players: {
    coll: 'players', sort: { createdAt: 1, _id: 1 },
    toUI: (d, ctx) => {
      const st = (ctx.stats && ctx.stats[d._id]) || {};
      const ms = f => (d.manualStats && d.manualStats[f] != null) ? d.manualStats[f] : (st[f] != null ? st[f] : '');
      return { id: d._id, name: d.name || '', birth: d.birthDate || '', club: ctx.clubs[d.clubId] || '', category: CAT[d.category] || d.category || '',
        position: d.positionLabel || '', foot: d.preferredFoot || 'Não informado', season: ms('season'), status: d.uiStatus || 'Elenco',
        height: d.heightCm == null ? '' : d.heightCm, minutes: ms('minutes'), goals: ms('goals'), assists: ms('assists'), notes: d.notes || '' };
    },
    fromUI: async (p, id, ctx) => {
      const prev = await ctx.col.findOne({ _id: id }, { projection: { positionLabel: 1 } });
      const off = await ctx.db.collection('player_season_stats').findOne({ playerId: id, competitionId: 'comp-serie-b', seasonId: 'season-serie-b-2026' });
      const o = (off && off.stats) || {};
      // só grava como "manual" o que difere do dado oficial carregado do provedor
      const manual = (v, official) => (num(v) === (official == null ? null : official)) ? null : num(v);
      const clubId = p.club ? 'club-' + slug(p.club) : null;
      if (clubId) await ctx.db.collection('clubs').updateOne({ _id: clubId }, { $setOnInsert: { name: p.club, shortName: p.club, city: null, state: null, country: 'BR', sourceRefs: [{ sourceId: MANUAL_SRC, collectedAt: today() }], lastVerifiedAt: null, createdAt: ctx.now } }, { upsert: true });
      const label = p.position || null;
      const positions = label ? [{ label, group: GROUP[label] || null, isPrimary: true, sourceId: MANUAL_SRC }] : [];
      const set = { name: p.name, birthDate: nz(p.birth), clubId, category: slug(p.category), positionLabel: label, positionGroup: GROUP[label] || null,
        preferredFoot: (!p.foot || p.foot === 'Não informado') ? null : p.foot, uiStatus: p.status || 'Elenco', heightCm: num(p.height),
        manualStats: { season: nz(p.season), minutes: manual(p.minutes, off && off.minutes), goals: manual(p.goals, o.goals), assists: manual(p.assists, o.assists) }, notes: p.notes || '' };
      const soi = { slug: slug(p.name) + '-' + String(id).slice(0, 6), shirtNumber: null, fullName: null, nationality: null, weightKg: null, contract: null, statistics: [],
        squadStatus: 'manual_entry', externalIds: {}, dataCompleteness: { identity: 'partial', physical: 'missing', contract: 'missing', statistics: 'missing' },
        sourceRefs: [{ sourceId: MANUAL_SRC, collectedAt: today() }], lastVerifiedAt: null };
      if (!prev) soi.positions = positions; else if (prev.positionLabel !== label) set.positions = positions;
      return { set, soi };
    },
  },
  market: {
    coll: 'market_targets', sort: { createdAt: 1, _id: 1 },
    toUI: d => ({ id: d._id, name: d.name || '', club: d.clubName || '', position: d.position || '', priority: d.priority || '', stage: d.stage || '', note: d.note || '' }),
    fromUI: async p => ({ set: { name: p.name, clubName: p.club || '', position: p.position || '', priority: p.priority || '', stage: p.stage || '', note: p.note || '' }, soi: {} }),
  },
  reports: {
    coll: 'scouting_reports', sort: { createdAt: -1 },
    toUI: d => ({ id: d._id, title: d.title || '', type: d.type || '', player: d.playerName || '', recommendation: d.recommendation || '', evidence: d.analysis || '', sources: d.sourcesText || '', date: d.dateLabel || '' }),
    fromUI: async p => ({ set: { title: p.title, type: p.type || '', playerName: p.player || '', recommendation: p.recommendation || '', analysis: p.evidence || '', sourcesText: p.sources || '', dateLabel: p.date || '' },
      soi: { playerId: null, authorType: 'human', evidenceRefs: [], confidence: null, limitations: null } }),
  },
  history: {
    coll: 'club_history', sort: { createdAt: 1, _id: 1 },
    toUI: d => ({ id: d._id, date: String(d.date || ''), title: d.title || '', type: d.category || '', detail: d.description || '',
      source: d.sourceUrl || ((d.sourceRefs && d.sourceRefs[0] && d.sourceRefs[0].url) || '') }),
    fromUI: async p => {
      const dt = String(p.date || '');
      const prec = /^\d{4}-\d{2}-\d{2}$/.test(dt) ? 'day' : /^\d{4}-\d{2}$/.test(dt) ? 'month' : /^\d{4}$/.test(dt) ? 'year' : 'text';
      return { set: { clubId: CLUB_ID, date: dt, datePrecision: prec, title: p.title, category: nz(p.type), description: nz(p.detail), sourceUrl: nz(p.source) },
        soi: { sourceRefs: [{ sourceId: MANUAL_SRC, collectedAt: today() }], lastVerifiedAt: null } };
    },
  },
};
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

async function getState() {
  const clubs = {};
  (await db.collection('clubs').find({}, { projection: { name: 1, shortName: 1 } }).toArray()).forEach(c => { clubs[c._id] = c.shortName || c.name; });
  const stats = {};
  (await db.collection('player_season_stats').find({ competitionId: 'comp-serie-b', seasonId: 'season-serie-b-2026' }).toArray()).forEach(x => {
    stats[x.playerId] = { season: '2026', minutes: x.minutes, goals: x.stats && x.stats.goals, assists: x.stats && x.stats.assists };
  });
  const out = {};
  for (const key of Object.keys(MAPS)) {
    const docs = await db.collection(MAPS[key].coll).find({}).sort(MAPS[key].sort).toArray();
    out[key] = docs.map(d => MAPS[key].toUI(d, { clubs, stats }));
  }
  const t = await db.collection('tactical_profiles').findOne({ _id: 'avai-current' });
  out.tactical = t ? { text: t.modelText || '', formation: t.formation || '', pressing: t.pressing || '' } : {};
  out.roles = (t && t.roles) || [];
  return out;
}

async function upsertItem(key, id, body) {
  const m = MAPS[key], col = db.collection(m.coll), now = new Date().toISOString();
  const r = await m.fromUI(body, id, { db, col, now });
  await col.updateOne({ _id: id }, { $set: Object.assign({}, r.set, { updatedAt: now }), $setOnInsert: Object.assign({}, r.soi, { createdAt: now }) }, { upsert: true });
}

async function saveTactical(fields) {
  const now = new Date().toISOString();
  const soi = { clubId: CLUB_ID, createdAt: now };
  if (!has(fields, 'roles')) soi.roles = [];
  await db.collection('tactical_profiles').updateOne({ _id: 'avai-current' }, { $set: Object.assign({}, fields, { updatedAt: now }), $setOnInsert: soi }, { upsert: true });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 1e6) { reject(new Error('payload grande demais')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }

async function api(req, res, parts) {
  const m = req.method;
  const write = m === 'PUT' || m === 'DELETE';
  // Bloqueia requisições "simples" vindas de outras páginas: escrita só com JSON.
  if (m === 'PUT' && String(req.headers['content-type'] || '').indexOf('application/json') !== 0) return send(res, 415, { error: 'use application/json' });
  if (m === 'GET' && parts[0] === 'state') return send(res, 200, await getState());
  if (m === 'PUT' && parts[0] === 'tactical') {
    const b = await readBody(req);
    await saveTactical({ modelText: b.text || '', formation: b.formation || '', pressing: b.pressing || '' });
    return send(res, 200, { ok: true });
  }
  if (m === 'PUT' && parts[0] === 'roles') {
    const b = await readBody(req);
    if (!Array.isArray(b)) return send(res, 400, { error: 'roles deve ser array' });
    await saveTactical({ roles: b });
    return send(res, 200, { ok: true });
  }
  if (write && parts.length === 2 && has(MAPS, parts[0])) {
    const id = decodeURIComponent(parts[1]);
    if (!id || id.length > 120) return send(res, 400, { error: 'id inválido' });
    if (m === 'DELETE') { await db.collection(MAPS[parts[0]].coll).deleteOne({ _id: id }); return send(res, 200, { ok: true }); }
    const b = await readBody(req);
    await upsertItem(parts[0], id, b);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'rota não encontrada' });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (file.indexOf(PUBLIC + path.sep) !== 0) { res.writeHead(403); return res.end('Proibido'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(rel === 'index.html' ? 'Coloque o seu HTML em public/index.html' : 'Não encontrado'); }
    if (path.basename(file) === 'index.html' && buf.indexOf('api-shim.js') === -1)
      buf = Buffer.from(buf.toString('utf8').replace('<script>', '<script src="/api-shim.js"></script>\n<script>'));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'api') return await api(req, res, parts.slice(1));
    serveStatic(u.pathname, res);
  } catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { error: e.message }); }
});

(async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection('sources').updateOne({ _id: MANUAL_SRC }, { $setOnInsert: { name: 'Cadastro manual (interface Scout Avaí)', type: 'manual', url: null, publisher: null,
    reliability: 'unverified', scope: 'Dados digitados na interface; exigem verificação.', usedInLoad: false, collectedAt: null } }, { upsert: true });
  server.listen(PORT, HOST, () => console.log('Scout Avaí em http://' + HOST + ':' + PORT + '  (banco: ' + DB_NAME + ')'));
})().catch(e => { console.error('ERRO ao iniciar:', e.message); process.exit(1); });
