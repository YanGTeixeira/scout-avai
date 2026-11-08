'use strict';
// Converte a resposta da API WordPress do site do Avaí (post type "elenco-profissional")
// para o formato interno. Cada campo vazio ou fora do padrão vira null: nada é estimado.

const POSITION_GROUP = { Goleiro: 'GK', Zagueiro: 'CB', Lateral: 'FB', Volante: 'DM', 'Meio-campo': 'MF', Atacante: 'FW' };

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#8211': '–', '#8212': '—', '#038': '&', '#039': "'" };
function decodeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (ENTITIES[e.toLowerCase()] != null) return ENTITIES[e.toLowerCase()];
      if (/^#x[0-9a-f]+$/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#\d+$/.test(e)) return String.fromCodePoint(Number(e.slice(1)));
      return m;
    })
    .trim();
}

const blank = (v) => v == null || String(v).trim() === '';
const toNumber = (s) => Number(String(s).replace(',', '.'));

// "1,65" | "1.93" | "175" | "1,65 m" -> centímetros inteiros (140–220) ou null
function parseHeightCm(v) {
  if (blank(v)) return null;
  const m = String(v).match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  let n = toNumber(m[0]);
  if (n < 3) n *= 100;
  n = Math.round(n);
  return n >= 140 && n <= 220 ? n : null;
}

// "62 Kg" | "62,8 kg" | "88.9" -> quilos com uma casa (40–130) ou null
function parseWeightKg(v) {
  if (blank(v)) return null;
  const m = String(v).match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Math.round(toNumber(m[0]) * 10) / 10;
  return n >= 40 && n <= 130 ? n : null;
}

// "23/11/2006" -> "2006-11-23" (data válida) ou null
function parseBirthDate(v) {
  if (blank(v)) return null;
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseShirt(v) {
  if (blank(v)) return null;
  const n = Number(String(v).trim());
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
}

// "Rio de Janeiro-RJ" | "Junqueirópolis_SP" | "São Paulo" -> { raw, city, state }
function parseBirthPlace(v) {
  if (blank(v)) return null;
  const raw = String(v).trim();
  const m = raw.match(/^(.*?)[\s]*[-_/][\s]*([A-Za-z]{2})$/);
  return m ? { raw, city: m[1].trim(), state: m[2].toUpperCase() } : { raw, city: raw, state: null };
}

// categories: [{id, name}] da taxonomia "categoria-do-jogador"
function normalizePlayer(entry, categories) {
  const meta = entry.meta || {};
  const catIds = entry['categoria-do-jogador'] || [];
  const cat = categories.find((c) => catIds.includes(c.id));
  const positionLabel = cat ? decodeHtml(cat.name) : null;
  return {
    wpId: entry.id,
    slug: entry.slug,
    url: entry.link,
    modifiedAt: entry.modified_gmt ? entry.modified_gmt + 'Z' : null,
    name: decodeHtml(entry.title && entry.title.rendered),
    fullName: blank(meta['nome-completo']) ? null : decodeHtml(meta['nome-completo']),
    shirtNumber: parseShirt(meta.numero),
    birthDate: parseBirthDate(meta.nascimento),
    birthPlace: parseBirthPlace(meta.naturalidade),
    heightCm: parseHeightCm(meta.altura),
    weightKg: parseWeightKg(meta.peso),
    positionLabel,
    positionGroup: positionLabel ? POSITION_GROUP[positionLabel] || null : null,
    raw: { numero: meta.numero, nascimento: meta.nascimento, altura: meta.altura, peso: meta.peso, naturalidade: meta.naturalidade },
  };
}

module.exports = { normalizePlayer, parseHeightCm, parseWeightKg, parseBirthDate, parseShirt, parseBirthPlace, decodeHtml, POSITION_GROUP };
