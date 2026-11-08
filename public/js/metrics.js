export const GROUPS = { GK: 'Goleiros', CB: 'Zagueiros', FB: 'Laterais', DM: 'Volantes', MF: 'Meias', FW: 'Atacantes' };
export const ORDER = Object.keys(GROUPS);
const per = (n, g) => (g > 0 && n != null ? n / g : null);
export const STATS = [
  { l: 'Jogos', f: (o) => o.appearances }, { l: 'Jogos como titular', f: (o) => o.startsDerived },
  { l: 'Gols', f: (o) => o.goals }, { l: 'Assistências', f: (o) => o.assists },
  { l: 'Finalizações', f: (o) => o.shots }, { l: 'Finalizações no alvo', f: (o) => o.shotsOnTarget },
  { l: 'Defesas', f: (o) => o.saves }, { l: 'Gols sofridos', f: (o) => o.goalsConceded, neutral: true },
  { l: 'Faltas sofridas', f: (o) => o.foulsSuffered }, { l: 'Faltas cometidas', f: (o) => o.foulsCommitted, neutral: true },
  { l: 'Cartões amarelos', f: (o) => o.yellowCards, neutral: true }, { l: 'Cartões vermelhos', f: (o) => o.redCards, neutral: true },
];
export const RATES = [
  { l: 'Gols por jogo', d: 2, f: (o) => per(o.goals, o.appearances) },
  { l: 'Assistências por jogo', d: 2, f: (o) => per(o.assists, o.appearances) },
  { l: 'Participações em gol por jogo', d: 2, f: (o) => (o.goals == null ? null : per(o.goals + (o.assists || 0), o.appearances)) },
  { l: 'Finalizações por jogo', d: 1, f: (o) => per(o.shots, o.appearances) },
  { l: 'Finalizações no alvo (%)', d: 0, f: (o) => (o.shots > 0 ? (o.shotsOnTarget / o.shots) * 100 : null) },
  { l: 'Faltas sofridas por jogo', d: 1, f: (o) => per(o.foulsSuffered, o.appearances) },
  { l: 'Faltas cometidas por jogo', d: 1, neutral: true, f: (o) => per(o.foulsCommitted, o.appearances) },
  { l: 'Cartões por jogo', d: 2, neutral: true, f: (o) => per((o.yellowCards || 0) + (o.redCards || 0), o.appearances) },
  { l: 'Defesas por jogo', d: 1, f: (o) => per(o.saves, o.appearances) },
  { l: 'Gols sofridos por jogo', d: 2, neutral: true, f: (o) => per(o.goalsConceded, o.appearances) },
  { l: 'Defesas (%)', d: 0, f: (o) => (o.saves != null && o.saves + o.goalsConceded > 0 ? (o.saves / (o.saves + o.goalsConceded)) * 100 : null) },
];
// Taxas do atleta com a escala do elenco e a média da posição (só atletas com 5+ jogos).
export function rateStats(p, all) {
  const pop = all.filter((x) => x.official && x.official.appearances >= 5);
  return RATES.map((r) => {
    const v = r.f(p.official);
    if (v == null) return null;
    const vals = pop.map((x) => r.f(x.official)).filter((x) => x != null);
    const g = pop.filter((x) => x.group === p.group).map((x) => r.f(x.official)).filter((x) => x != null);
    return { l: r.l, d: r.d, v, max: Math.max(...vals, v), avg: g.length ? g.reduce((a, b) => a + b, 0) / g.length : null };
  }).filter(Boolean);
}
