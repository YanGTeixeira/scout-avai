# Módulo de Inteligência de Futebol — Etapas 1 e 2

Auditoria das fontes, auditoria do projeto atual e arquitetura proposta.
Data da análise: 2026-11-08. Nenhum código de integração foi escrito ainda: este documento existe para ser validado antes da Etapa 3.

---

## Resumo executivo

1. **API-Futebol é a única das três fontes que pode alimentar o MongoDB de forma legítima e estável.** Ela cobre 74 campeonatos (Séries A–D, estaduais, base, Libertadores, Sul-Americana e cinco ligas europeias). Entrega partidas com escalações, substituições, gols, cartões e estatísticas **de equipe**. **Não** entrega elenco por clube, ficha completa de atleta (nascimento, nacionalidade, altura), assistências, estatísticas individuais, contratos, salários, valores de mercado, transferências nem lesões.
2. **Os widgets do SofaScore são iframes visuais, não dados.** São gratuitos e atualizam em tempo real, mas não expõem nada legível por máquina. Servem para enriquecer a interface, não para abastecer o banco.
3. **A API interna do SofaScore (`api.sofascore.com/api/v1`) não é um produto oferecido.** Não tem documentação, licença nem chave, e respondeu `403 Forbidden` a partir deste servidor. Montar um pipeline sobre ela é frágil e tem risco contratual. O repositório `victorstdev/sofascore-api-stats` é um script Python de 4 endpoints, parado desde mar/2024 e **sem licença**: não serve como dependência e seu código não pode ser copiado.
4. **Consequência direta para os objetivos:** com essas fontes dá para construir minutos jogados (derivados), titularidade, gols, cartões, contexto coletivo e histórico de clubes por temporada. Isso vale para milhares de atletas em dezenas de ligas. Já indicadores individuais ricos (assistências, ações defensivas, passes, xG) e dados financeiros e contratuais **não vêm de nenhuma das três**. A arquitetura deixa o espaço preparado, mas esses campos ficarão como `ausente` até haver uma fonte licenciada ou um registro manual com evidência. A IA será instruída a dizer isso, e não a estimar.
5. **O projeto atual tem uma boa base de proveniência** (`sourceRefs`, `lastVerifiedAt`, `dataCompleteness`, `evidenceLevel`). Em compensação, está **acoplado a um único clube e a uma única temporada**: `CLUB_ID` fixo, consultas presas a `comp-serie-b/season-serie-b-2026` e `_id` de jogador com prefixo do clube. **Ainda não existe nenhum sistema de IA (LLM) no código.** A camada de IA será criada do zero.

---

## Etapa 1 — Auditoria

### 1.1 Projeto atual

| Aspecto | Situação encontrada | Impacto no módulo |
|---|---|---|
| Runtime | Node 22 (`.nvmrc`), `engines >=18`. `server.js` usa `http` puro, sem framework, e se declara compatível com Node 12 | O módulo novo usa Node 18+ (`fetch` nativo, `node:test`) sem alterar `server.js` além de montar rotas |
| Dependências | Só `mongodb@^4.17` | Driver suficiente. Nenhuma dependência nova é obrigatória |
| Backend | `server.js`: `GET /api/state` (despeja tudo) e `PUT/DELETE /api/{players,market,reports,history}/:id`, além de `tactical` e `roles` | Rotas novas ficam em `/api/intel/*`, sem tocar as existentes |
| Frontend | `public/` com ES modules (elenco, painel, comparador, clube) e `legado.html` com `api-shim.js` que redireciona o `localStorage` | Sem impacto. Telas novas são opcionais e posteriores |
| Coleções | 16 em `schema.js`, mais `market_targets` (criada pelo servidor, fora do schema) | Mantidas. As novas entram em `schema.js` seguindo o mesmo padrão |
| Validação | `$jsonSchema` em modo `warn` | Mantido. As coleções novas usam o mesmo padrão |
| IDs | Strings legíveis: `club-avai`, `avai-pro-kaua-santos`, `comp-serie-b` | Os IDs existentes são preservados. Entidades novas recebem IDs internos opacos (ver 2.4) |
| Acoplamentos | `CLUB_ID = 'club-avai'`; `getState()` e `fromUI()` consultam só Série B 2026; índice único `players(clubId, slug)` | O jogador precisa existir independente do clube (ele muda de clube). Ver 2.4 |
| Estatísticas | 33 docs em `player_season_stats` vindos da ESPN, `minutes: null`, casamento por camisa + nome parcial, `needsReview: true` | É o padrão certo (provedor, `asOf`, `limitations`) e vira o modelo para os novos provedores |
| Proveniência | `sources` (catálogo com `reliability`), `sourceRefs[]` por doc, `evidenceLevel` em contratos (`confirmed`, `news`, `estimate`) | Base reaproveitada e estendida (ver 2.6) |
| IA | Inexistente. Há só `authorType: 'ai'` previsto em `scouting_reports` e `observations` | A camada de IA é nova (Etapa 6) |
| Jobs, fila, logs | Inexistentes | Novos: worker separado (ver 2.7) |
| Testes | Inexistentes | Novos, com `node:test` |

### 1.2 API-Futebol (`https://api.api-futebol.com.br/v1`)

Fontes lidas: `https://www.api-futebol.com.br/ai.md`, OpenAPI 3.1, `/planos`, `/cobertura`, `/termos-de-uso`.

**Acesso**
- Header `Authorization: Bearer <key>`. A conta tem uma chave `live` e uma `test`; a `test` não consome o limite.
- Sucesso sem envelope. Erros no formato `{ codigo, mensagem }`: `401` chave inválida, `403` fora do plano, `404`, `429` limite, `5xx`.
- Listas **sem paginação**: `/tabela`, `/artilharia`, `/rodadas` e as partidas de um time vêm completas. Só `/noticias` é paginada.
- `GET /me` informa o plano, `plano.requisicoes` e os campeonatos liberados. Os campeonatos devem ser resolvidos por `slug`, nunca por ID fixo.

**Endpoints e o que cada um rende para a base**

| Endpoint | Rende | Observação |
|---|---|---|
| `GET /campeonatos`, `/campeonatos/{id}` | Competição, edição (`edicao_id`, `temporada`), fases | Catálogo, mudança rara |
| `/campeonatos/{id}/tabela` | Posição, pontos, V/E/D, gols pró e contra, aproveitamento, últimos jogos | Array em pontos corridos, **objeto por grupo** em fase de grupos |
| `/campeonatos/{id}/artilharia` | `atleta_id`, gols, time | Ajuda a descobrir atletas |
| `/campeonatos/{id}/fases`, `/fases/{fase_id}` | Chaves de mata-mata, grupos e rodadas | Forma muda conforme o `tipo` |
| `/campeonatos/{id}/rodadas`, `/rodadas/{n}` | Partidas da rodada **com placar** | Base da atualização incremental |
| `/campeonatos/{id}/partidas` | Todas as partidas por fase e rodada, **sem placar** | Calendário |
| `/partidas/{id}` | **O endpoint central:** estatísticas por equipe (posse, passes, finalizações, desarmes, defesas, escanteios, impedimentos, faltas), escalações (titulares, reservas, posição, camisa, esquema, técnico), gols (minuto, pênalti, contra), substituições (minuto), cartões, estádio | Jogos futuros vêm sem estatísticas e sem escalação |
| `/times/{id}` | Nome, sigla, escudo, apelido | Ficha mínima |
| `/times/{id}/partidas/{proximas,anteriores,ao-vivo}` | Jogos do time por campeonato | |
| `/atletas/{id}` | `nome_popular`, `nome`, `posicao` | **Só isso**: sem nascimento, nacionalidade, pé, altura |
| `/ao-vivo` | Partidas em andamento com placar | O guia recomenda *polling* a cada 15 a 30 s |
| `/noticias` | Notícias classificadas e ligadas a `time_id` | Útil como sinal de mercado (rumores), **nunca como fato** |

**O que dá para derivar (e como marcar)**
- **Minutos jogados por atleta e partida**, a partir de titular/reserva, minuto das substituições e cartões vermelhos. São *derivados*, não oficiais: os acréscimos não vêm na API, então a duração da partida é assumida como 90 min (ou 120 com prorrogação) e o dado leva `status: derived`.
- Jogos, jogos como titular, entradas do banco, gols (com e sem pênalti), gols contra, cartões, posição escalada, esquema tático do time, técnico.
- **Histórico de clubes por temporada:** cada escalação registra "atleta X jogou pelo clube Y na data Z".
- **Elenco "observado":** quem foi relacionado nos últimos N jogos. A API **não tem endpoint de elenco**, então o elenco oficial continua vindo do site do clube, da CBF ou de cadastro manual.
- Contexto coletivo: médias por jogo de posse, passes, finalizações e desarmes, além da tabela.

**O que a API não oferece**: assistências, estatísticas individuais (passes, desarmes, finalizações por atleta), notas, xG, mapas de calor, contrato, salário, valor de mercado, transferências e lesões.

**Cobertura** (página `/cobertura`, 74 campeonatos): Brasileirão A, B, C e D, Sub-17, Sub-20, femininos, Copa do Brasil, todos os estaduais (inclusive o Catarinense), Copinha, Copa do Nordeste, Copa Verde, Libertadores, Sul-Americana, Recopa, Premier League, La Liga, Bundesliga, Campeonato Italiano e Campeonato Francês, Champions, Liga Europa e outros. A página tem uma legenda de completude ("Completo", "Parcial", "Indisponível") por coluna (Classificação, Rodadas, Partidas, Ao vivo, Escalações, Estatísticas). Os ícones de cada célula não puderam ser lidos em texto, então **a completude de escalações e estatísticas em Série C, Série D e estaduais precisa ser conferida** com a chave `test` antes do *backfill*.

**Planos e limites** (página `/planos`, nov/2026)

| Plano | Preço | Campeonatos | Requisições |
|---|---|---|---|
| Flexível | a partir de R$ 99/mês **por campeonato** | à escolha | não informado na página |
| Profissional | R$ 599/mês | 10 | 2.000/dia |
| Elite | R$ 999/mês | 20 | 5.000/dia, inclui "estatísticas avançadas" |
| Enterprise | sob consulta | todos | ilimitadas, com SLA |

O limite é renovado à meia-noite (UTC-3). A FAQ da página chama os planos de "Startup e Profissional" com 2.000 e 5.000/dia, o que não bate com a tabela. **Confirmar com o fornecedor.** Também não está claro o que são as "estatísticas avançadas" do Elite.

**Termos**: licença limitada e intransferível, com redistribuição e revenda proibidas. *Scraping* massivo é proibido. A própria documentação recomenda um *cron* que popule **o seu banco**, então guardar no MongoDB para uso próprio é o uso previsto. **Se a plataforma for oferecida a vários clubes (SaaS), é preciso confirmar com o fornecedor**, porque isso pode ser lido como redistribuição.

**Orçamento de requisições (estimativa)**: uma temporada de Série B tem 380 partidas. O *backfill* de uma edição custa cerca de 380 (`/partidas/{id}`) + 38 (`/rodadas/{n}`) + algumas de catálogo, ou seja, **~430 requisições**. No incremental, uma rodada custa ~10 partidas + 1 rodada + 1 tabela, ou **~12 por campeonato por rodada**. Com 10 campeonatos ativos, o incremental fica bem abaixo de 200/dia. O *backfill* de 10 campeonatos (~4.300) se distribui em 2 a 3 dias no plano Profissional. O ao vivo a cada 30 s custa 120 req/hora: **só ligar se houver uso real** e apenas em janelas com jogo.

### 1.3 SofaScore Widgets (`corporate.sofascore.com/br/widgets`)

- O que é: elemento visual (**iframe**) gerado no próprio site do SofaScore ("navegue até a liga, copie o código do iframe"). Os tipos citados incluem classificação da liga, jogador e partida.
- **Gratuito e "sem nenhuma limitação"**, atualizado em tempo real.
- **Não entrega dados** ao nosso backend: é renderizado no navegador, dentro de outro domínio. Ler o conteúdo do iframe seria *scraping*.
- O SofaScore não oferece API de dados na página corporativa. O B2B é publicidade, parcerias de mídia (infográficos) e parcerias esportivas.

**Uso recomendado**: guardar o `sofascoreId` de clubes, atletas e torneios em `external_ids` e exibir o widget correspondente na ficha do atleta ou do clube. É um enriquecimento **visual** com atribuição ao SofaScore, e a IA não lê esse conteúdo.

### 1.4 API interna do SofaScore e repositório `victorstdev/sofascore-api-stats`

**API interna (`https://api.sofascore.com/api/v1/...`)**
- É a API que o site e o app do SofaScore usam. É rica (estatísticas individuais por temporada, notas, mapas de calor, histórico de transferências, "valor de mercado" estimado, atributos), mas **não é documentada nem licenciada e não tem chave**.
- Teste deste servidor (2026-11-08): `GET /unique-tournament/390/seasons` retornou **`403 {"error":{"code":403,"reason":"Forbidden"}}`**. `robots.txt` e os termos de uso de `www.sofascore.com` também retornaram 403, então os termos não puderam ser lidos.
- Riscos: bloqueio a qualquer momento (proteção anti-bot, mais comum contra IPs de *datacenter*), mudança silenciosa de formato, violação de termos e exposição jurídica. Contornar o bloqueio (*headers* forjados, navegador automatizado, proxies) **não será feito** neste projeto.

**Repositório `victorstdev/sofascore-api-stats`**

| Item | Achado |
|---|---|
| Linguagem | Python + `requests` |
| Licença | **Nenhuma**: todos os direitos reservados ao autor. O código não pode ser reutilizado |
| Manutenção | 12 commits, último em **24/03/2024**. README vazio, `tests.py` quebrado |
| Endpoints | `/tournament/{id}/seasons`, `/tournament/{id}/season/{sid}/standings/total`, `/tournament/{id}/season/{sid}/events`, `/event/{id}/statistics`. **Só nível de equipe** |
| Acesso | `requests.get` com User-Agent de Chrome, sem autenticação |
| Robustez | Sem timeout, sem retry, sem *rate limit*. Em caso de erro devolve `None` e quebra adiante |
| Saída | Um JSON por time em disco, sobrescrito a cada execução |

**Conclusão:** o repositório só documenta 4 caminhos da API interna, e todos os dados que ele cobre (tabela, partidas, estatísticas de equipe) já vêm licenciados pela API-Futebol. **Não será usado como dependência nem como base de código.**

**Como o SofaScore entra na arquitetura:** como **adaptador de provedor desativado por padrão** (`providers/sofascore`), com interface pronta. Ele só será ativado se houver acesso **autorizado**: parceria ou licença com o SofaScore, ou um provedor licenciado que redistribua esses dados. Até lá, o SofaScore aparece só nos widgets e nos `external_ids`.

### 1.5 Sobreposição e lacunas

| Dado | API-Futebol | Widgets SofaScore | API interna SofaScore | Fontes já no projeto |
|---|---|---|---|---|
| Competições, temporadas, tabela | ✅ | 👁 visual | ⚠️ não autorizada | — |
| Partidas, placar, calendário | ✅ | 👁 | ⚠️ | site do clube |
| Estatísticas de equipe por jogo | ✅ | 👁 | ⚠️ | — |
| Escalações, substituições, cartões | ✅ | 👁 | ⚠️ | — |
| Minutos por atleta | 🟡 derivado | 👁 | ⚠️ | ESPN: não publica |
| Gols por atleta | ✅ | 👁 | ⚠️ | ESPN (Avaí) |
| Assistências | ❌ | 👁 | ⚠️ | ESPN (Avaí) |
| Estatísticas individuais (passes, desarmes etc.) | ❌ | 👁 | ⚠️ | ESPN parcial: finalizações, faltas |
| Elenco oficial atual | ❌ (só "observado") | — | ⚠️ | site do clube, CBF |
| Nascimento, nacionalidade, altura, pé | ❌ | 👁 | ⚠️ | manual |
| Contrato, salário, valor, transferências | ❌ | — | ⚠️ (valor é **estimativa** do SofaScore) | manual com `evidenceLevel` |
| Lesões | ❌ | — | ⚠️ | manual |
| Ao vivo | ✅ polling 15–30 s | ✅ visual | ⚠️ | — |

Legenda: ✅ disponível e licenciado · 🟡 derivado · 👁 só visual · ⚠️ existe, mas sem autorização · ❌ inexistente

**Lacunas críticas para a inteligência de mercado** e caminhos legítimos (a avaliar, não implementados):
- **Contratos e registros**: o **BID da CBF** (Boletim Informativo Diário) é público e oficial para registros de contrato no Brasil. Precisa de avaliação técnica e dos termos de uso.
- **Estatísticas individuais ricas**: provedores licenciados de dados por atleta (Opta/Stats Perform, Wyscout/Hudl, StatsBomb, Sportmonks, API-Football/api-sports, entre outros). Custo e cobertura da Série B precisam ser cotados.
- **Valor de mercado e salários**: não existe fonte aberta confiável. Ficam como registro manual com `evidenceLevel: news | estimate` e fonte obrigatória. Transfermarkt e similares proíbem coleta automatizada.
- **Perfil financeiro do clube** (orçamento, folha, teto salarial): entrada manual do próprio clube, sempre marcada como dado interno.

---

## Etapa 2 — Arquitetura proposta

### 2.1 Princípios
1. **Três camadas de dados:** `raw` (resposta original do provedor) → `normalized` (formato interno, ainda por provedor) → `canonical` (entidade consolidada). Nada é perdido e tudo é reprocessável.
2. **Provedor é plugável:** cada provedor implementa a mesma interface. O núcleo nunca importa código de provedor diretamente.
3. **Proveniência em cada fato:** nenhum número entra no canônico sem fonte, data e status.
4. **Ausente é diferente de zero:** `null` com motivo, nunca um valor inventado.
5. **Não regredir o existente:** coleções e rotas atuais continuam funcionando. O módulo novo só acrescenta.

### 2.2 Estrutura de pastas

```
src/intel/
  core/
    http.js            cliente HTTP: timeout, retry com backoff (1s,2s,4s), classificação de erro
    rateLimiter.js     token bucket por provedor + cota diária persistida (api_usage)
    cache.js           leitura/gravação em raw_payloads com política de frescor por endpoint
    provenance.js      helpers de proveniência (makeProv, mergeProv)
    logger.js          log estruturado JSON (provedor, job, duração, status, requisições)
    ids.js             geração de IDs internos (plr_, clb_, cmp_, ssn_, mtc_)
  providers/
    Provider.js        contrato: listCompetitions, getSeason, getStandings, getMatches,
                       getMatch, getTeam, getPlayer, capabilities()
    apiFutebol/        client.js · endpoints.js · mapper.js (raw → normalized) · capabilities
    sofascore/         adapter desativado (enabled:false) + widgets.js (só URLs de embed)
    manual/            importação de CSV/JSON com evidência (contratos, valores, finanças)
  identity/
    normalizeName.js   remove acentos, ordena tokens, trata apelidos
    resolver.js        casamento de entidades: chaves externas → regras → score → fila de revisão
  consolidation/
    rules.js           precedência por campo e por fonte
    consolidate.js     normalized → canonical + registro de conflitos
  sync/
    jobs/              catalog, season-backfill, round-incremental, match-finalize, live, standings
    scheduler.js       agenda (cron simples interno) + lock em Mongo
    queue.js           fila persistida em sync_jobs (status, tentativas, backoff)
  analytics/
    derive.js          minutos derivados, per90, taxas
    benchmarks.js      percentis por posição × competição × temporada, com minutos mínimos
    shrinkage.js       ajuste bayesiano para amostras pequenas
    leagueContext.js   coeficientes de nível de liga (configuráveis, marcados como estimativa)
  market/
    squadNeeds.js      carências por posição
    candidates.js      busca e filtragem de alvos
    scoring.js         score explicável (fit, desempenho, disponibilidade, viabilidade)
    similarity.js      jogadores semelhantes e substitutos
    compare.js         comparação de N jogadores com contexto e amostragem
  ai/
    tools.js           ferramentas (JSON Schema) que a IA pode chamar
    answerContract.js  formato de resposta: dados + proveniência + limitações
    llm/               adaptador do provedor de LLM (a definir)
  api/routes.js        /api/intel/* montado em server.js
worker.js              processo separado que roda o scheduler e a fila
```

### 2.3 Fluxo de dados

```
 provedor ──► core/http (rate limit, cota, retry)
                │
                ▼
          raw_payloads  (hash do conteúdo; se igual ao anterior, não reprocessa)
                │  mapper do provedor
                ▼
          normalized (em memória/staging por job)
                │  identity/resolver  ──► external_ids, entity_review_queue
                ▼
          consolidation ──► coleções canônicas (players, clubs, matches, ...)
                │                └► field_conflicts
                ▼
          analytics (agregados, percentis)  ──► player_season_stats, team_season_stats, benchmarks
                │
                ▼
          market + ai/tools  ──► respostas com proveniência  ──► intel_analyses (auditoria)
```

### 2.4 Identidade e deduplicação

- **IDs internos:** entidades novas recebem IDs opacos e estáveis (`plr_01J…`, `clb_01J…`). **Os IDs atuais (`avai-pro-*`, `club-*`) são preservados** para não quebrar a interface. Quem tem esses IDs passa a ser tratado como entidade canônica normal.
- **Jogador desacoplado do clube:** `players.clubId` passa a significar "clube atual (derivado)". O vínculo histórico fica em `player_club_spells`. O índice `uniq_club_slug` continua, mas a busca por identidade passa a usar `external_ids` e `normName`.
- **`external_ids`**: `{ provider, entityType, externalId, entityId, method, confidence, linkedAt }` com índice único `(provider, entityType, externalId)`. Um mesmo jogador pode ter IDs da API-Futebol, da ESPN, do SofaScore e do site do clube.
- **Resolver**, em ordem:
  1. ID externo já ligado: casamento direto.
  2. Regra forte: mesmo clube + mesma temporada + nome normalizado igual (ou camisa igual com nome parcial, como já se faz com a ESPN).
  3. Score: similaridade de nome (tokens, apelido × nome completo), posição, clube e período sobrepostos, data de nascimento (quando houver).
  4. Score ≥ 0,92 com pelo menos uma evidência forte: *merge* automático. Entre 0,70 e 0,92: `entity_review_queue` para revisão humana. Abaixo disso: nova entidade.
- Toda fusão é registrada e **reversível** (`mergedFrom`, histórico em `entity_merges`).

### 2.5 Coleções

**Existentes (mantidas e estendidas, sem renomear)**

| Coleção | Extensões |
|---|---|
| `sources` | Novas entradas: `src-api-futebol`, `src-sofascore-widgets`; campos `provider`, `license`, `capabilities` |
| `clubs` | `externalIds`, `country`, `crestUrl`, `normName` |
| `players` | `normName`, `aliases[]`, `externalIds`, `currentClubDerived {clubId, asOf, method}`. Campos factuais com bloco `prov` |
| `competitions`, `seasons` | `externalIds` (`campeonato_id`, `edicao_id`), `format`, `tier`, `country` |
| `matches` | `externalIds`, `teamStats {home, away}`, `lineups`, `events[]` (gols, cartões, substituições), `formation`, `coach`, `prov` |
| `player_match_stats` | Preenchida pela API-Futebol: `started`, `minutes` + `minutesMethod: 'derived_lineup'`, `goals`, `penaltyGoals`, `ownGoals`, `yellow`, `red`, `positionPlayed`. Uma linha por provedor (o índice único já existe) |
| `player_season_stats` | Agregados por provedor (`provider: 'api_futebol'`, `'espn_deportes'`) e um consolidado (`provider: 'consolidated'`) com origem de cada campo |
| `contracts` | Mantém `evidenceLevel`. Recebe `prov` e `validFrom/validTo` |

**Novas**

| Coleção | Função | Chave e índices principais |
|---|---|---|
| `raw_payloads` | Resposta bruta de cada chamada, para cache e auditoria | `(provider, endpoint, paramsHash)`; `contentHash`; `fetchedAt` |
| `external_ids` | Mapa de IDs externos para internos | único `(provider, entityType, externalId)`; `(entityType, entityId)` |
| `player_club_spells` | Vínculo atleta–clube por temporada, derivado de escalações ou registrado oficialmente | `(playerId, clubId, seasonId)`; `firstSeen`, `lastSeen`, `appearances` |
| `team_season_stats` | Tabela e médias coletivas por clube, competição e temporada | único `(clubId, competitionId, seasonId, provider)` |
| `standings_snapshots` | Fotografia da tabela por rodada (histórico versionado) | `(competitionId, seasonId, round)` |
| `player_valuations` | Valor de mercado e custo estimado, **sempre** com fonte e `evidenceLevel` | `(playerId, asOf)` |
| `player_transfers` | Transferências e empréstimos com evidência | `(playerId, date)` |
| `player_availability` | Lesões e suspensões (só com fonte confiável) | `(playerId, from)` |
| `club_finances` | Orçamento, folha e teto salarial informados pelo clube analisado | `(clubId, seasonYear)` |
| `benchmarks` | Distribuições (percentis) por posição × competição × temporada | `(competitionId, seasonId, positionGroup, metric)` |
| `field_conflicts` | Divergências entre fontes no mesmo campo | `(entityType, entityId, field)` |
| `entity_review_queue`, `entity_merges` | Deduplicação assistida | `status`, `score` |
| `sync_jobs` | Fila: tipo, parâmetros, status, tentativas, `runAfter`, erro | `(status, runAfter)` |
| `sync_state` | Marcas d'água por recurso (ex.: última rodada sincronizada) | único `(provider, resource, key)` |
| `api_usage` | Contador de requisições por provedor e dia | único `(provider, day)` |
| `intel_analyses` | Saídas de análise e da IA com entradas, versão do algoritmo e limitações | `(clubId, type, createdAt)` |
| `data_quality_issues` | Problemas detectados (minutos > duração, atleta em dois clubes no mesmo dia...) | `(severity, status)` |

### 2.6 Proveniência e confiabilidade

Todo campo factual relevante segue o formato abaixo (no próprio documento ou em subdocumento por grupo de campos):

```js
prov: {
  sourceId: 'src-api-futebol',       // referência ao catálogo `sources`
  provider: 'api_futebol',
  externalRef: 'partidas/27650',
  collectedAt: '2026-11-08T14:02:11Z',
  updatedAt:   '2026-11-08T14:02:11Z',
  status: 'confirmed' | 'derived' | 'reported' | 'estimated',
  confidence: 'high' | 'medium' | 'low',
  method: 'lineup_substitutions_90min',   // obrigatório quando derived/estimated
}
```

- `confirmed`: vem do provedor tal como publicado. `derived`: calculado por nós a partir de dados confirmados (o método é obrigatório). `reported`: notícia ou rumor. `estimated`: estimativa de terceiros ou nossa, nunca apresentada como fato.
- É uma extensão do `evidenceLevel` existente: `confirmed` → `confirmed`, `news` → `reported`, `estimate` → `estimated`.
- **Precedência por campo** (`consolidation/rules.js`). Exemplos: camisa = site oficial > API-Futebol > ESPN; gols da temporada = soma das partidas da API-Futebol > ESPN; data de nascimento = CBF > manual com fonte. Quando duas fontes divergem acima de uma tolerância, o canônico usa a de maior precedência e grava o conflito em `field_conflicts`, que a IA pode consultar.

### 2.7 Sincronização, frequência real e falhas

| Job | Gatilho | Endpoints | Observação |
|---|---|---|---|
| `catalog` | semanal | `/me`, `/campeonatos`, `/campeonatos/{id}` | Detecta novas edições e campeonatos liberados no plano |
| `season-backfill` | sob demanda | `/rodadas`, `/rodadas/{n}`, `/partidas/{id}` | Retomável pela marca d'água; respeita a cota diária |
| `round-incremental` | a cada 15 min em janelas de jogo; 1×/dia fora delas | `/rodadas/{n}` | Só busca partidas novas ou com status alterado |
| `match-finalize` | T+30 min, T+6 h e T+48 h após o fim | `/partidas/{id}` | Captura correções tardias. Se o `contentHash` não mudar, não reprocessa |
| `standings` | após cada rodada concluída | `/tabela` | Gera `standings_snapshots` |
| `entity-refresh` | na descoberta + trimestral | `/times/{id}`, `/atletas/{id}` | Ficha mínima |
| `live` | **opcional**, a cada 30 s só durante jogos monitorados | `/ao-vivo` ou `/times/{id}/partidas/ao-vivo` | Desligado por padrão (custo de cota) |
| `analytics-rebuild` | após ingestão | — | Agregados, percentis e score de mercado |

- **Tempo real:** só a API-Futebol tem algo próximo disso (placar e eventos via *polling*). Estatísticas individuais **não são** em tempo real em nenhuma fonte autorizada. Widgets do SofaScore são em tempo real apenas na tela.
- **Cota:** `api_usage` é consultado antes de cada chamada. Os jobs têm prioridade (finalize > incremental > backfill), e o backfill é o primeiro a parar quando a cota passa de 80%.
- **Falhas:** `429` e `5xx` são reenfileirados com backoff exponencial e *jitter*. `401` e `403` pausam o provedor e geram alerta. `404` é marcado e não repetido. O lock por job em Mongo evita execução duplicada.
- **Logs:** um JSON por execução de job (requisições, cache hits, docs criados e atualizados, conflitos, duração), consultável em `/api/intel/health`.
- **Processo:** um `worker.js` separado do `server.js` (`npm run worker`). Uma falha de sincronização não derruba a interface.

### 2.8 Inteligência estatística e comparação

- **Taxas por 90 min** apenas com minutos conhecidos. Como os minutos da API-Futebol são derivados, isso fica explícito na resposta.
- **Amostra mínima** configurável (padrão: 450 min). Abaixo dela, o atleta aparece com "amostra insuficiente" e a métrica passa por *shrinkage* em direção à média da posição.
- **Percentis** calculados dentro de posição × competição × temporada. Comparações entre ligas usam coeficientes de nível de liga **configuráveis e rotulados como estimativa**: nenhuma das fontes fornece um.
- **Regularidade:** dispersão por partida (minutos, participações), sequência de jogos como titular, proporção de jogos disponíveis.
- **Contexto do clube:** força do time (tabela e médias coletivas). Um atacante de time que finaliza pouco tende a ter menos gols.
- **Indicadores defensivos, de passe e participação em gols** ficam marcados como **indisponíveis** enquanto não houver provedor de estatística individual. A comparação mostra a lacuna em vez de omiti-la.

### 2.9 Inteligência de mercado

- **Carências do elenco (`squadNeeds`):** profundidade por posição (atletas com minutos relevantes), concentração de minutos, idade média e distribuição etária, contratos a vencer (se houver dado), desempenho em percentil da liga e requisitos do `tactical_profiles` (já existente).
- **Candidatos:** busca na base global por posição, idade, ligas e minutos. Componentes do score, cada um com cobertura de dados:
  - *Fit* esportivo: posição, função, idade e curva de desenvolvimento.
  - *Desempenho*: percentis ajustados.
  - *Disponibilidade*: uso no clube atual (subutilizado = poucos minutos com desempenho bom), fim de contrato quando conhecido.
  - *Viabilidade*: só quando há `club_finances` **e** um custo com evidência. **Sem dado, o componente é "desconhecido", não zero**, e a recomendação diz isso.
- **Oportunidades:** jogadores com desempenho acima do percentil esperado para a liga, o clube e a faixa de custo (quando conhecida), jovens com minutos crescentes e ligas menos exploradas (estaduais, Série C e D).
- Toda análise é salva em `intel_analyses` com entradas, versão do algoritmo e limitações, para ser auditável.

### 2.10 Camada para a IA

A IA não lê o banco livremente: ela chama **ferramentas** com contrato fixo.

| Ferramenta | Pergunta que responde |
|---|---|
| `get_squad(clubId, season)` | Elenco, minutos, idade e status |
| `get_squad_needs(clubId)` | Carências e justificativas |
| `search_players(filtros)` | Busca no mercado |
| `get_player_profile(playerId)` | Ficha com proveniência por campo |
| `compare_players(ids[], contexto)` | Comparação ajustada por amostra e liga |
| `find_similar(playerId)` / `find_replacements(playerId)` | Semelhantes e substitutos |
| `find_opportunities(clubId, critérios)` | Subutilizados, em evolução, bom custo-benefício |
| `get_data_coverage(escopo)` | O que existe e o que falta, para a IA citar limitações |

Toda ferramenta devolve `{ data, provenance, limitations, coverage }`. O *prompt* de sistema obriga a citar fonte e data, separar fato de estimativa e declarar lacunas. O provedor de LLM fica atrás de um adaptador em `ai/llm/`.

### 2.11 Validação (Etapa 7)

- Testes unitários (`node:test`) dos *mappers* com respostas de exemplo da documentação: tabela em array e em objeto, fase de mata-mata e de grupos, `posicao` polimórfica, pênaltis.
- Testes do *resolver* com casos reais de nomenclatura (apelido × nome completo, acentos, homônimos).
- Testes de minutos derivados: titular substituído, reserva que entrou, vermelho, prorrogação.
- Integração com a chave `test` da API-Futebol (não consome cota).
- Checagens de consistência em `data_quality_issues`: soma de gols das partidas × placar, atleta escalado por dois clubes na mesma data, minutos acima da duração.

---

## Plano de execução proposto

| Etapa | Entrega | Depende de |
|---|---|---|
| 3a | `core` (http, rate limit, cota, cache, logs) + provedor API-Futebol + testes de *mapper* | Chave `test` |
| 3b | `identity` + `consolidation` + coleções novas em `schema.js` (sem alterar as atuais) | 3a |
| 3c | `worker.js` + jobs `catalog`, `season-backfill`, `round-incremental`, `match-finalize`, `standings` | 3b |
| 4 | Agregados, `player_club_spells`, `team_season_stats`, ligação dos 35 atletas atuais à API-Futebol | 3c |
| 5 | `analytics` + `market` (carências, busca, score, comparação, similaridade) | 4 |
| 6 | Ferramentas da IA + rotas `/api/intel/*` + adaptador de LLM | 5 e escolha do LLM |
| 7 | Bateria de validação + relatório de cobertura por campeonato | todas |

## Decisões pendentes (do responsável pelo projeto)

1. **Plano e chave da API-Futebol:** quais campeonatos entram primeiro? Sugestão inicial: Série B (o próprio campeonato), Série A, Série C, Catarinense e Copa do Brasil, além de Série D e estaduais conforme o orçamento. A chave fica em `API_FUTEBOL_KEY` no `.env`, nunca no repositório.
2. **SofaScore:** confirmar o uso **só de widgets e `external_ids`**, sem consumir a API interna. Ou informar se há parceria ou licença.
3. **Estatística individual:** aceitar a lacuna nesta fase ou cotar um provedor licenciado (assistências, ações defensivas, passes).
4. **Provedor de LLM** para a Etapa 6.
5. **Uso multi-clube:** se a plataforma for vendida ou compartilhada com outros clubes, confirmar com a API-Futebol que isso não configura redistribuição.
