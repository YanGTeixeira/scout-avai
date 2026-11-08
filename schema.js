'use strict';

// Ordem de carga (referências primeiro).
const COLLECTIONS = [
  'sources', 'clubs', 'stadiums', 'competitions', 'seasons', 'players', 'matches',
  'club_titles', 'club_history',
  'contracts', 'player_match_stats', 'player_season_stats',
  'scouting_reports', 'tactical_profiles', 'observations', 'obsidian_documents', 'sofascore_widgets',
  'raw_payloads', 'sync_runs', 'field_conflicts', 'ai_sessions',
];

// Campos "gerenciados pela fonte": o seed os atualiza a cada execução ($set).
// Todo o resto só é gravado na PRIMEIRA inserção ($setOnInsert).
// Coleções sem entrada aqui são tratadas como dado de referência (todos os campos via $set).
// players: lista vazia = o seed só insere atletas novos e nunca sobrescreve os existentes.
// Quem atualiza o elenco é o coletor do site do clube (npm run sync:avai), que guarda a origem de cada campo.
const MANAGED_FIELDS = {
  players: [],
};

const str = { bsonType: 'string' };
const strOrNull = { bsonType: ['string', 'null'] };

const VALIDATORS = {
  players: {
    bsonType: 'object',
    required: ['_id', 'clubId', 'name', 'sourceRefs', 'lastVerifiedAt'],
    properties: {
      clubId: str, name: str, slug: str,
      shirtNumber: { bsonType: ['int', 'long', 'double', 'null'] },
      fullName: strOrNull, birthDate: strOrNull, nationality: strOrNull,
      heightCm: { bsonType: ['int', 'double', 'null'] }, weightKg: { bsonType: ['int', 'double', 'null'] },
      sourceRefs: { bsonType: 'array' }, statistics: { bsonType: 'array' },
    },
  },
  matches: {
    bsonType: 'object',
    required: ['_id', 'competitionId', 'seasonId', 'homeClubId', 'awayClubId', 'status'],
    properties: { status: { enum: ['scheduled', 'live', 'finished', 'postponed', 'cancelled'] } },
  },
  player_match_stats: {
    bsonType: 'object',
    required: ['_id', 'playerId', 'matchId', 'competitionId', 'seasonId', 'minutes', 'provider'],
  },
  player_season_stats: {
    bsonType: 'object',
    required: ['_id', 'playerId', 'competitionId', 'seasonId', 'minutes', 'provider'],
  },
  contracts: {
    bsonType: 'object',
    required: ['_id', 'playerId', 'clubId', 'sourceRefs'],
    properties: { evidenceLevel: { enum: ['confirmed', 'news', 'estimate'] } },
  },
  scouting_reports: {
    bsonType: 'object',
    required: ['_id', 'playerId', 'authorType', 'createdAt', 'evidenceRefs', 'confidence', 'limitations'],
    properties: { authorType: { enum: ['human', 'ai'] }, evidenceRefs: { bsonType: 'array' } },
  },
  observations: {
    bsonType: 'object',
    required: ['_id', 'authorType', 'createdAt'],
    properties: { authorType: { enum: ['human', 'ai'] } },
  },
  obsidian_documents: {
    bsonType: 'object',
    required: ['_id', 'vaultPath', 'contentHash'],
  },
  sofascore_widgets: {
    bsonType: 'object',
    required: ['_id', 'entityType', 'entityId', 'src', 'height'],
    properties: {
      entityType: { enum: ['player', 'club', 'competition', 'match'] },
      src: { bsonType: 'string', pattern: '^https://widgets\\.sofascore\\.com/' },
      height: { bsonType: ['int', 'long', 'double'] },
    },
  },
};

const INDEXES = {
  players: [
    [{ clubId: 1, slug: 1 }, { unique: true, name: 'uniq_club_slug' }],
    [{ clubId: 1, shirtNumber: 1 }, { name: 'club_shirt' }],
    [{ positionGroup: 1 }, { name: 'position_group' }],
    [{ name: 1 }, { name: 'name' }],
    [{ 'externalIds.avaiSite': 1 }, { name: 'ext_avai_site', sparse: true }],
  ],
  matches: [
    [{ seasonId: 1, date: 1 }, { name: 'season_date' }],
    [{ competitionId: 1, round: 1 }, { name: 'comp_round' }],
    [{ homeClubId: 1 }, { name: 'home' }], [{ awayClubId: 1 }, { name: 'away' }],
  ],
  seasons: [[{ competitionId: 1, year: 1 }, { unique: true, name: 'uniq_comp_year' }]],
  club_titles: [[{ clubId: 1, competitionName: 1 }, { name: 'club_comp' }]],
  club_history: [[{ clubId: 1, date: 1 }, { name: 'club_date' }]],
  contracts: [[{ playerId: 1, startDate: -1 }, { name: 'player_start' }]],
  player_match_stats: [
    [{ matchId: 1, playerId: 1, provider: 1 }, { unique: true, name: 'uniq_match_player_provider' }],
    [{ playerId: 1, seasonId: 1 }, { name: 'player_season' }],
  ],
  player_season_stats: [
    [{ playerId: 1, competitionId: 1, seasonId: 1, provider: 1 }, { unique: true, name: 'uniq_player_comp_season_provider' }],
  ],
  scouting_reports: [[{ playerId: 1, createdAt: -1 }, { name: 'player_created' }]],
  observations: [[{ playerId: 1, createdAt: -1 }, { name: 'player_created' }]],
  obsidian_documents: [
    [{ vaultPath: 1 }, { unique: true, name: 'uniq_vault_path' }],
    [{ contentHash: 1 }, { name: 'content_hash' }],
  ],
  sofascore_widgets: [[{ entityType: 1, entityId: 1 }, { name: 'entity' }]],
  sync_runs: [[{ source: 1, startedAt: -1 }, { name: 'source_started' }]],
  field_conflicts: [[{ entityType: 1, entityId: 1, field: 1 }, { name: 'entity_field' }], [{ status: 1 }, { name: 'status' }]],
  raw_payloads: [[{ provider: 1, fetchedAt: -1 }, { name: 'provider_fetched' }]],
  ai_sessions: [[{ createdAt: -1 }, { name: 'created' }]],
};

module.exports = { COLLECTIONS, MANAGED_FIELDS, VALIDATORS, INDEXES };
