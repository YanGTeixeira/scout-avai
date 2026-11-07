# Dicionário de dados — Scout Avaí

## Coleções
- `clubs`: clubes e metadados institucionais.
- `players`: identidade e cadastro de atletas.
- `stadiums`: estádios e centros de treinamento.
- `competitions`: competições.
- `seasons`: temporadas.
- `matches`: partidas.
- `player_match_stats`: estatísticas de atleta por partida.
- `player_season_stats`: agregados por atleta/competição/temporada.
- `contracts`: vínculo, vigência, empréstimo e fonte.
- `scouting_reports`: avaliações produzidas por observadores/IA.
- `tactical_profiles`: modelo de jogo, treinador e funções.
- `observations`: observações qualitativas com autoria, data e evidência.
- `club_history`: eventos históricos.
- `club_titles`: conquistas.
- `sources`: catálogo de fontes e confiabilidade.
- `obsidian_documents`: índice de notas Markdown do Obsidian.

## Convenções
- `_id`: identificador estável (string nesta fase; pode ser ObjectId no futuro).
- Datas: ISO-8601 (`YYYY-MM-DD`) ou timestamp ISO com fuso.
- Campos desconhecidos: `null` ou ausentes; nunca estimar silenciosamente.
- Referências: guardar IDs internos e `sourceRefs`.
- Estatísticas: incluir sempre unidade, competição, temporada, minutos e provedor.
- Avaliações: guardar `authorType` (humano/IA), `createdAt`, `evidenceRefs`, `confidence` e `limitations`.
- Contratos: separar fato confirmado, notícia e estimativa; não preencher vigência sem fonte.
