'use strict';
// Monta o retrato do elenco que a IA recebe: só dados que existem no MongoDB, com origem e limitações.
// Nada aqui é estimado; campo sem dado aparece como "—".
const CLUB_ID = 'club-avai';
const GROUP_LABEL = { GK: 'Goleiro', CB: 'Zagueiro', FB: 'Lateral', DM: 'Volante', MF: 'Meio-campo', FW: 'Atacante' };
const ORDER = ['GK', 'CB', 'FB', 'DM', 'MF', 'FW'];

function ageOn(iso, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const t = now;
  return t.getUTCFullYear() - y - (t.getUTCMonth() + 1 < m || (t.getUTCMonth() + 1 === m && t.getUTCDate() < d) ? 1 : 0);
}
const v = (x) => (x == null || x === '' ? '—' : String(x));
const avg = (xs) => { const a = xs.filter((x) => x != null); return a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null; };

async function buildTeamContext(db, { now = new Date() } = {}) {
  const players = (await db.collection('players').find({ clubId: CLUB_ID }).toArray())
    .filter((p) => p.category === 'profissional' && p.squadStatus !== 'not_listed_on_official_page');
  const stats = {};
  (await db.collection('player_season_stats').find({ competitionId: 'comp-serie-b', seasonId: 'season-serie-b-2026' }).toArray())
    .forEach((s) => { stats[s.playerId] = s; });
  const tactical = await db.collection('tactical_profiles').findOne({ _id: 'avai-current' });
  const clubs = {};
  (await db.collection('clubs').find({}).toArray()).forEach((c) => { clubs[c._id] = c.shortName || c.name; });
  const matches = (await db.collection('matches').find({}).toArray())
    .filter((m) => m.homeClubId === CLUB_ID || m.awayClubId === CLUB_ID).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const market = await db.collection('market_targets').find({}).toArray();
  const reports = (await db.collection('scouting_reports').find({}).toArray()).slice(-10);

  const rows = players.map((p) => {
    const s = stats[p._id] || {}, o = s.stats || {};
    return { id: p._id, name: p.name, shirt: p.shirtNumber, group: p.positionGroup, label: p.positionLabel, age: ageOn(p.birthDate, now),
      height: p.heightCm, weight: p.weightKg, foot: p.preferredFoot, apps: o.appearances, starts: o.startsDerived, subs: o.substituteAppearances,
      goals: o.goals, assists: o.assists, shots: o.shots, sot: o.shotsOnTarget, yellow: o.yellowCards, red: o.redCards,
      saves: o.saves, conceded: o.goalsConceded, fouls: o.foulsCommitted, fouled: o.foulsSuffered, asOf: s.asOf, review: !!s.needsReview };
  }).sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || (b.starts || 0) - (a.starts || 0));

  const asOf = rows.map((r) => r.asOf).filter(Boolean).sort().pop() || null;
  const lines = [];
  lines.push(`Clube: Avaí Futebol Clube (Florianópolis-SC). Competição de referência: Campeonato Brasileiro Série B 2026. Data de hoje: ${now.toISOString().slice(0, 10)}.`);
  lines.push('');
  lines.push(`ELENCO PROFISSIONAL (${rows.length} atletas). Estatísticas da Série B 2026 pela ESPN${asOf ? ` até ${asOf}` : ''}; cadastro (idade, altura, peso) pelo site oficial do clube.`);
  lines.push('Nº | Atleta | Posição | Idade | Altura cm | Pé | Jogos | Titular | Reserva | Gols | Assist. | Finaliz. | No alvo | Amarelos | Vermelhos | Defesas | Gols sofridos');
  for (const r of rows) {
    lines.push([v(r.shirt), r.name + (r.review ? ' (vínculo com a fonte a conferir)' : ''), v(r.label), v(r.age), v(r.height), v(r.foot), v(r.apps), v(r.starts), v(r.subs),
      v(r.goals), v(r.assists), v(r.shots), v(r.sot), v(r.yellow), v(r.red), r.group === 'GK' ? v(r.saves) : '—', r.group === 'GK' ? v(r.conceded) : '—'].join(' | '));
  }
  lines.push('');
  lines.push('RESUMO POR POSIÇÃO');
  for (const g of ORDER) {
    const ps = rows.filter((r) => r.group === g);
    if (!ps.length) continue;
    const used = ps.filter((r) => r.apps > 0);
    lines.push(`- ${GROUP_LABEL[g]}: ${ps.length} atletas, idade média ${v(avg(ps.map((r) => r.age)))}, altura média ${v(avg(ps.map((r) => r.height)))} cm, ${used.length} com jogos; mais utilizados: ${used.slice(0, 3).map((r) => `${r.name} (${r.starts} como titular)`).join(', ') || 'nenhum'}.`);
  }
  lines.push('');
  lines.push('MODELO DE JOGO DEFINIDO PELA COMISSÃO');
  if (tactical && (tactical.modelText || tactical.formation || tactical.pressing || (tactical.roles || []).length)) {
    lines.push(`- Formação base: ${v(tactical.formation)}. Altura de pressão: ${v(tactical.pressing)}.`);
    if (tactical.modelText) lines.push(`- Descrição: ${tactical.modelText}`);
    for (const r of tactical.roles || []) lines.push(`- Requisito para ${r.position}: ${r.requirement}`);
  } else lines.push('- Não cadastrado.');
  lines.push('');
  lines.push('JOGOS DO AVAÍ CADASTRADOS');
  if (!matches.length) lines.push('- Nenhum.');
  for (const m of matches) {
    const home = clubs[m.homeClubId] || m.homeClubId, away = clubs[m.awayClubId] || m.awayClubId;
    const score = m.status === 'finished' && m.score ? `${m.score.home} x ${m.score.away}` : (m.status === 'scheduled' ? 'agendado' : m.status);
    lines.push(`- Rodada ${v(m.round)}, ${m.date}: ${home} x ${away} (${score})`);
  }
  // Próximo jogo: o primeiro agendado a partir de hoje (jogo de data passada ainda sem placar não conta).
  const today = now.toISOString().slice(0, 10);
  const next = matches.find((m) => m.status === 'scheduled' && String(m.date) >= today);
  if (market.length) {
    lines.push('');
    lines.push('ALVOS DE MERCADO EM ACOMPANHAMENTO');
    for (const m of market) lines.push(`- ${m.name} (${v(m.clubName)}, ${v(m.position)}), prioridade ${v(m.priority)}, etapa ${v(m.stage)}${m.note ? `: ${m.note}` : ''}`);
  }
  if (reports.length) {
    lines.push('');
    lines.push('RELATÓRIOS RECENTES DA COMISSÃO');
    for (const r of reports) lines.push(`- ${v(r.title)} (${v(r.type)}): parecer ${v(r.recommendation)}`);
  }
  const limitations = [
    'Não há minutos jogados: titularidade e jogos vêm da ESPN; "Titular" é jogos menos entradas como reserva.',
    'Não há dados de lesões, suspensões, condição física, treinos ou contratos.',
    'Não há dados táticos individuais (passes, duelos, desarmes, mapas de calor) nem dados dos adversários além do nome.',
    'O pé dominante raramente está cadastrado.',
  ];
  lines.push('');
  lines.push('LIMITAÇÕES DOS DADOS');
  limitations.forEach((l) => lines.push('- ' + l));

  const opponent = next ? (next.homeClubId === CLUB_ID ? clubs[next.awayClubId] : clubs[next.homeClubId]) : null;
  return {
    text: lines.join('\n'),
    summary: { players: rows.length, withStats: rows.filter((r) => r.apps != null).length, statsAsOf: asOf, formation: (tactical && tactical.formation) || null,
      nextMatch: next ? { date: next.date, opponent, home: next.homeClubId === CLUB_ID } : null, marketTargets: market.length, reports: reports.length },
    limitations,
  };
}

module.exports = { buildTeamContext };
