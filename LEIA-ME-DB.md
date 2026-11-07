# Scout Avaí — Base inicial MongoDB

Data de referência da coleta: 2026-11-07

## Conteúdo
- `players.json`: elenco profissional listado na página oficial do Avaí na data da coleta (35 registros).
- `clubs.json`, `stadiums.json`: cadastro inicial do clube e da Ressacada.
- `competitions.json`, `seasons.json`: competições/temporada de referência.
- `club_history.json`, `club_titles.json`: fatos históricos e títulos divulgados pelo próprio clube.
- `sources.json`: catálogo de fontes e escopo de cada fonte.
- Coleções de partidas, estatísticas, contratos, observações e relatórios: arquivos vazios para receber dados verificados.
- `seed.js`: script idempotente de carga (faz upsert por `_id`).

## Importação
1. Instale Node.js 18+.
2. Na pasta extraída, execute `npm install mongodb`.
3. Configure `MONGODB_URI` com sua conexão MongoDB Atlas ou local.
4. Execute `node seed.js`.

Exemplo local:
`MONGODB_URI="mongodb://127.0.0.1:27017" MONGODB_DB="scout_avai" node seed.js`

Também é possível importar individualmente com `mongoimport`:
`mongoimport --uri "$MONGODB_URI" --db scout_avai --collection players --file players.json --jsonArray`

## Cuidados com os dados
- O elenco é uma fotografia da página pública oficial do Avaí consultada em 2026-11-07; não significa que todos os nomes estejam inscritos, disponíveis ou sob contrato na data de cada partida.
- O número e a posição são os rótulos publicados na página do clube. Não foram inferidos pé dominante, idade, altura, nacionalidade, contrato ou estatísticas.
- `fullName`, data de nascimento, atributos físicos e estatísticas estão nulos/vazios quando não confirmados nesta coleta.
- A página da CBF é fonte complementar de registros da Série B 2026, mas pode listar atletas que já deixaram o clube; não foi usada para declarar elenco atual.
- Títulos e fatos históricos foram transcritos da página institucional do Avaí.
- Não há dados de base Sub-20/Sub-17/Sub-15 nesta primeira carga: a fonte pública confiável e atualizada precisa ser identificada antes de inserir nomes.
- Dados públicos continuam sujeitos a atualização. Revalidar elenco, contratos e situação dos atletas antes de qualquer decisão.

## Fontes públicas iniciais
- Avaí — elenco profissional: https://avai.com.br/futebol/profissional/
- CBF — Série B 2026, atletas: https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20058?tab=atletas
- Avaí — história e títulos: https://avai.com.br/clube/historia/
- Avaí — Ressacada: https://avai.com.br/clube/ressacada/

## Modelo de documento de jogador
O documento de jogador já inclui campos para:
`positions`, `statistics`, `contract`, `sourceRefs`, `lastVerifiedAt` e `dataCompleteness`.

## Próxima expansão recomendada
1. Adicionar elenco de base por categoria somente após confirmar listas oficiais.
2. Importar partidas e estatísticas por API licenciada, guardando `provider`, `externalId`, `collectedAt` e `sourceRef`.
3. Integrar Obsidian: cada nota indexada em `obsidian_documents` com `vaultPath`, `frontmatter`, `content`, `contentHash`, `updatedAt` e referências.
4. Manter fatos e avaliações separados: estatística observada não é parecer de scout.
