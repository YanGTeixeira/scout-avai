#!/usr/bin/env node
'use strict';
/**
 * Carga inicial (idempotente) do banco Scout Avaí.
 *
 *   node seed.js              upsert seguro (não sobrescreve campos preenchidos manualmente)
 *   node seed.js --dry-run    valida os arquivos e mostra o plano, sem conectar
 *   node seed.js --force      sobrescreve TODOS os campos presentes nos JSONs
 *   --skip-indexes / --skip-validators
 *
 * Variáveis: MONGODB_URI (obrigatória fora do dry-run), MONGODB_DB (padrão: scout_avai)
 */
const fs = require('node:fs');
const path = require('node:path');
const { COLLECTIONS, MANAGED_FIELDS, VALIDATORS, INDEXES } = require('./schema');

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const FORCE = args.has('--force');
const DATA_DIR = path.join(__dirname, 'data');
const BATCH = 500;

function load(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Arquivo ausente: ${file}`);
  const docs = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(docs)) throw new Error(`${name}.json deve ser um array`);
  const seen = new Set();
  for (const d of docs) {
    if (typeof d._id !== 'string' || !d._id) throw new Error(`${name}: documento sem _id string`);
    if (seen.has(d._id)) throw new Error(`${name}: _id duplicado "${d._id}"`);
    seen.add(d._id);
  }
  return docs;
}

function buildOp(name, doc, now) {
  const { _id, createdAt, updatedAt, ...rest } = doc;
  const managed = MANAGED_FIELDS[name];
  const $set = { updatedAt: now };
  const $setOnInsert = { createdAt: now };
  for (const [k, v] of Object.entries(rest)) {
    if (FORCE || !managed || managed.includes(k)) $set[k] = v;
    else $setOnInsert[k] = v;
  }
  return { updateOne: { filter: { _id }, update: { $set, $setOnInsert }, upsert: true } };
}

async function main() {
  const data = Object.fromEntries(COLLECTIONS.map(n => [n, load(n)]));

  // Integridade referencial básica entre os arquivos
  const ids = n => new Set(data[n].map(d => d._id));
  const refs = [
    ['players', 'clubId', 'clubs'], ['matches', 'competitionId', 'competitions'], ['matches', 'seasonId', 'seasons'],
    ['matches', 'homeClubId', 'clubs'], ['matches', 'awayClubId', 'clubs'], ['seasons', 'competitionId', 'competitions'],
    ['club_titles', 'clubId', 'clubs'], ['club_history', 'clubId', 'clubs'],
  ];
  for (const [col, field, target] of refs) {
    const valid = ids(target);
    for (const d of data[col]) if (d[field] != null && !valid.has(d[field]))
      throw new Error(`${col}/${d._id}: ${field}="${d[field]}" não existe em ${target}`);
  }

  console.log(`${DRY ? '[dry-run] ' : ''}Modo: ${FORCE ? 'force (sobrescreve campos)' : 'seguro (preserva dados manuais)'}`);
  for (const n of COLLECTIONS) console.log(`  ${n.padEnd(22)} ${String(data[n].length).padStart(4)} docs`);
  if (DRY) { console.log('Validação OK. Nada foi gravado.'); return; }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Defina MONGODB_URI');
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'scout_avai');
  console.log(`Conectado. Banco: ${db.databaseName}`);

  try {
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
    for (const name of COLLECTIONS) {
      const validator = !args.has('--skip-validators') && VALIDATORS[name] ? { $jsonSchema: VALIDATORS[name] } : null;
      const opts = validator ? { validator, validationLevel: 'moderate', validationAction: 'warn' } : {};
      if (!existing.has(name)) await db.createCollection(name, opts);
      else if (validator) await db.command({ collMod: name, ...opts });

      if (!args.has('--skip-indexes'))
        for (const [keys, o] of INDEXES[name] || []) await db.collection(name).createIndex(keys, o);

      const now = new Date().toISOString();
      const ops = data[name].map(d => buildOp(name, d, now));
      let up = 0, mod = 0, match = 0;
      for (let i = 0; i < ops.length; i += BATCH) {
        const r = await db.collection(name).bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
        up += r.upsertedCount; mod += r.modifiedCount; match += r.matchedCount;
      }
      console.log(`  ✔ ${name.padEnd(22)} inseridos=${up} atualizados=${mod} existentes=${match}`);
    }
    console.log('Carga concluída.');
  } finally {
    await client.close();
  }
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
