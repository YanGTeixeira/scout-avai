#!/usr/bin/env node
'use strict';
/**
 * Atualiza o elenco profissional a partir do site oficial do Avaí.
 *
 *   npm run sync:avai               sincroniza e grava
 *   npm run sync:avai -- --dry-run  mostra o que mudaria, sem gravar
 *   npm run sync:avai -- --force    reprocessa mesmo se o site não mudou
 *
 * Variáveis: MONGODB_URI (obrigatória), MONGODB_DB (padrão: scout_avai).
 * Depois da coleta, cruza os vínculos com a ESPN usando o nome completo e a camisa oficiais.
 * Faz 2 requisições por execução. Uma vez por dia é suficiente (ex.: cron "17 6 * * *").
 */
const { MongoClient } = require('mongodb');
const { fetchJson } = require('../lib/http');
const { syncAvaiSquad } = require('../lib/avai-site/sync');
const { crossCheckEspn } = require('../lib/crosscheck/espn-vs-club');

const args = new Set(process.argv.slice(2));

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Defina MONGODB_URI');
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'scout_avai');
    const run = await syncAvaiSquad({ db, fetchJson, dryRun: args.has('--dry-run'), force: args.has('--force') });
    console.log(`${run.dryRun ? '[dry-run] ' : ''}Status: ${run.status}`);
    if (run.status === 'unchanged') console.log('O site não mudou desde a última coleta.');
    else {
      const c = run.counts;
      console.log(`Atletas no site: ${c.fetched} | novos: ${c.created} | atualizados: ${c.updated} | sem mudança: ${c.unchanged} | saíram da página: ${c.delisted} | voltaram: ${c.relisted} | divergências: ${c.conflicts}`);
      for (const ch of run.changes) console.log(`  ${ch.playerId}  ${ch.field}: ${JSON.stringify(ch.from)} -> ${JSON.stringify(ch.to)}`);
      for (const k of run.conflicts) console.log(`  DIVERGÊNCIA ${k.playerId}  ${k.field}: atual ${JSON.stringify(k.current.value)} (${k.current.sourceId}) x site ${JSON.stringify(k.proposed.value)}`);
    }
    const cc = await crossCheckEspn({ db, dryRun: run.dryRun });
    const flagged = cc.filter((r) => r.after);
    console.log(`Cruzamento com a ESPN: ${cc.length} vínculos conferidos, ${cc.length - flagged.length} confirmados, ${flagged.length} a conferir.`);
    for (const r of flagged) console.log(`  CONFERIR ${r.playerId}: ESPN "${r.crossCheck.providerName}" camisa ${r.crossCheck.providerShirt} x clube "${r.crossCheck.officialName}" (${r.crossCheck.officialFullName}) camisa ${r.crossCheck.officialShirt}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
