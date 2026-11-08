# Fontes de dados alternativas ao SofaScore

Pesquisa de 2026-11-08. Objetivo: encontrar fontes **autorizadas** (licença, plano pago ou dado público oficial) para estatísticas individuais, elencos, transferências, contratos e indicadores de força, sem depender de *scraping*.

> **Grau de verificação.** Os sites dos fornecedores estão bloqueados pela rede deste ambiente, então a pesquisa foi feita por busca na web. Preços e coberturas abaixo vêm de páginas dos próprios fornecedores quando indicado, ou de terceiros (inclusive concorrentes, sinalizados). **Tudo precisa ser confirmado com um teste real antes da contratação**, principalmente a cobertura da **Série B** em estatísticas por atleta, que nenhuma fonte confirmou explicitamente.

## Resumo e recomendação

| Prioridade | Fonte | Para quê | Custo indicativo |
|---|---|---|---|
| 1 | **API-Football (api-sports.io)** | Estatísticas por atleta (temporada e partida), elencos, transferências, lesões | Grátis (100 req/dia) a ~US$ 39/mês |
| 2 | **Sportmonks** | Mesmo papel, como alternativa ou comparação | ~€ 69 a € 129/mês, teste de 14 dias |
| 3 | **Hudl Wyscout / StatsBomb, Stats Perform (Opta)** | Scouting profissional: eventos detalhados, vídeo, dados avançados | Sob consulta (alto) |
| Complemento | **BID da CBF** | Registro oficial de contratos no Brasil | Gratuito, consulta manual |
| Complemento | **ClubElo** | Rating de força de clubes | Gratuito; provável cobertura só europeia |
| Descartado | Transfermarkt, FBref, Capology, Understat, API interna do SofaScore | — | Coleta automatizada proibida ou não autorizada |

**Próximo passo sugerido:** criar a conta gratuita da API-Football e, com as 100 requisições/dia, verificar se a Série B 2026 tem `statistics` por atleta preenchidas (minutos, assistências, passes, desarmes, nota). Se tiver, ela cobre boa parte das lacunas do documento 01 com custo baixo. Em paralelo, o teste de 14 dias da Sportmonks serve de comparação.

## Teste real da API-Football (2026-11-08, conta gratuita)

| Item | Resultado |
|---|---|
| Cobertura declarada (`/leagues?country=Brazil`) | **Série A e Série B 2026**, Paulista A1 e Carioca 1: estatísticas por partida e **por atleta**. Série C, Série D, Catarinense e demais: só escalações, eventos e tabela (`statistics_players: false`). Lesões: só Série A |
| Plano grátis | **Só temporadas 2022 a 2024.** A temporada 2026 retorna `Free plans do not have access to this season`. Parâmetro `last` também bloqueado |
| Estatística por atleta (Série B 2024, Avaí) | Minutos, jogos, titularidade, nota, gols, assistências, finalizações, passes (total e decisivos), desarmes, bloqueios, interceptações, duelos, dribles, faltas, cartões, pênaltis. Ficha com nascimento, nacionalidade, altura e peso. Campos ausentes vêm `null`. `passes.accuracy` na temporada não é percentual: verificar antes de usar |
| Por partida (`/fixtures/players`) | Mesmos grupos de estatística, com minutos e nota por jogo |
| Elenco atual (`/players/squads`) | Liberado no grátis: 39 atletas do Avaí. 32 dos nossos 35 batem pela camisa e 24 pelo nome exato, então o casamento precisa do *resolver* (camisa + nome) |
| Transferências (`/transfers`) | Liberado no grátis, com data, tipo (Free, Loan, N/A) e clubes |
| Limites | 100 req/dia e 10 req/min no grátis (headers `x-ratelimit-*`) |

**Conclusão:** a API-Football tem os dados individuais da Série B 2026 de que o projeto precisa, mas **a temporada atual só vem em plano pago** (Pro, ~US$ 19/mês, 7.500 req/dia, a confirmar na contratação).

## 1. APIs comerciais com dados por atleta

### API-Football (api-sports.io)
- **O que oferece:** jogos, escalações, eventos, estatísticas de partida e **estatísticas por atleta** (por temporada e por partida), elencos, **transferências**, **lesões**, técnicos e troféus. Os grupos de endpoint *lineups*, *statistics*, *events* e *players* aparecem na listagem do RapidAPI.
- **Preços (a confirmar na página oficial):**
  - Free: 100 req/dia.
  - Pro: US$ 19/mês, 7.500 req/dia.
  - Ultra: US$ 29/mês, 75.000 req/dia.
  - Mega: US$ 39/mês, 150.000 req/dia.

  Esses valores vêm do guia da própria API-Football e da listagem no RapidAPI. A página de preços oficial cita planos até 1.500.000 req/dia.
- **Ponto de atenção:** comparativos de concorrentes (Sportmonks, TheStatsAPI) dizem que em ligas menores muitas vezes vêm partidas **sem** estatísticas de atleta. É uma fonte enviesada, mas é exatamente o que precisa ser testado na Série B.
- **Encaixe na arquitetura:** provedor `providers/apiFootball`, com o mesmo contrato do documento 01. Os IDs de atleta vão para `external_ids`.

### Sportmonks
- **O que oferece:** partidas, ao vivo, eventos, elencos, tabelas e estatísticas por atleta. Segundo a página de planos, todos os planos têm os mesmos dados e variam apenas no número de ligas e no volume de chamadas.
- **Preços:** a página oficial cita Advanced a € 69/mês e All-In a € 129/mês. Um terceiro (jul/2026) cita outra tabela (€ 29 / € 99 / € 249), possivelmente desatualizada.
- **Brasil:** há página dedicada ao Brasileirão Série A com teste de 14 dias. **A Série B não foi confirmada.** Transferências também não foram confirmadas.

### football-data.org
- Plano gratuito com 12 competições, placares com atraso, tabelas, limite de 10 req/min. O código `BSA` (Brasileirão Série A) existe, mas não ficou claro se está no plano grátis.
- **Não traz estatísticas detalhadas por atleta.** Pouco útil para scouting e redundante com a API-Futebol.

### TheStatsAPI
- Afirma ter 24 temporadas do Brasileirão Série A com estatísticas de atleta e xG. É menos conhecida, e as informações vêm do próprio site, que é material comparativo de marketing. Só vale avaliar se as duas primeiras opções falharem.

## 2. Provedores profissionais de scouting

| Fornecedor | Observações |
|---|---|
| **Hudl Wyscout** | Padrão de mercado em scouting, com vídeo e dados. Tem API de dados em JSON e "packs" de conteúdo. Preço sob consulta, por login. Em dez/2025 anunciou uma API que liga os IDs do StatsBomb e do Wyscout |
| **Hudl StatsBomb** | Eventos detalhados e métricas avançadas. Sob consulta |
| **Stats Perform (Opta)** | O Palmeiras anunciou acordo em jan/2024 (Opta Vision), o primeiro clube sul-americano a adotá-lo. Sob consulta |

São as fontes mais completas (eventos, xG, ações defensivas, vídeo), mas o custo é alto e a contratação é comercial. A arquitetura aceita qualquer uma delas como provedor. Vale pedir cotação **específica para Série B e Série C**.

## 3. Fontes oficiais e abertas

### BID da CBF (Boletim Informativo Diário)
- É o registro oficial de contratos de atletas no Brasil. Com o Fair Play Financeiro da CBF, contratos (com salário e direito de imagem) precisam ser cadastrados para a publicação no BID ser liberada.
- **Não há API pública documentada.** Terceiros citam a consulta em `bid.cbf.com.br`, mas isso precisa ser confirmado no portal.
- **Uso recomendado:** consulta manual de vínculos e datas de contrato, registrados em `contracts` com `evidenceLevel: confirmed` e o link do BID como fonte. Para automatizar, só com autorização da CBF ou da federação.

### ClubElo (`api.clubelo.com`)
- API em CSV com rating Elo de clubes desde 1939 (valores antes de 1960 são provisórios).
- **A cobertura de clubes brasileiros não foi confirmada.** Os exemplos encontrados são europeus. Útil para comparar ligas europeias, mas provavelmente não resolve o nível da Série B. Precisa de um teste com um clube brasileiro.

## 4. Fontes descartadas

| Fonte | Motivo |
|---|---|
| API interna do SofaScore (e `sofascore-api-stats`, ScraperFC) | Não é produto oferecido. Respondeu 403 a este servidor e só funciona driblando a proteção contra robôs |
| Transfermarkt | Termos proíbem coleta automatizada. Valor de mercado é estimativa do site |
| FBref, Understat | Coleta da página (*scraping*), com limites de acesso. Cobertura brasileira restrita |
| Capology | Salários estimados, site comercial |

Valores de mercado e salários **continuam sem fonte autorizada**. Ficam como registro manual com `evidenceLevel: news | estimate` e fonte obrigatória.

## Fontes consultadas
- API-Football — guia de início: https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide
- API-Football — preços: https://www.api-football.com/pricing
- RapidAPI — API-Football: https://rapidapi.com/api-sports/api/api-football/pricing
- TheStatsAPI — comparativos (concorrente): https://www.thestatsapi.com/blog/best-football-api , https://www.thestatsapi.com/blog/thestatsapi-vs-api-football
- Sportmonks — planos: https://www.sportmonks.com/football-api/plans-pricing
- Sportmonks — Brasileirão: https://www.sportmonks.com/football-api/brasileirao-api/
- Sportmonks — comparação com API-Football (concorrente): https://www.sportmonks.com/football-api/alternatives/api-football/
- OddsPapi — comparação Sportmonks: https://oddspapi.io/blog/?p=3154
- football-data.org — limites do plano grátis: https://www.thestatsapi.com/blog/football-data-org-free-tier-limits-2026
- Hudl Wyscout — API de dados: https://www.hudl.com/en_gb/products/wyscout/data-api
- Hudl Wyscout — preços: https://www.hudl.com/en_gb/products/wyscout/pricing
- Stats Perform — Palmeiras: https://www.statsperform.com/?p=28552
- CBF Fair Play Financeiro e BID: https://www.mktesportivo.com/2025/11/cbf-implementa-fair-play-financeiro-com-monitoramento-triplo-anual-e-punicoes-graduais/
- ClubElo via soccerdata: https://soccerdata.readthedocs.io/en/latest/datasources/ClubElo.html
