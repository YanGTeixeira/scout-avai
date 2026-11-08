# Scout Avaí — Base inicial MongoDB

Data de referência da coleta: 2026-11-07

## Importação rápida
```bash
npm install
export MONGODB_URI="mongodb://127.0.0.1:27017"   # ou sua string do Atlas
export MONGODB_DB="scout_avai"
npm run seed:dry   # valida os arquivos, sem conectar
npm run seed       # cria coleções, validadores, índices e carrega os dados
```
Requer Node.js 18+. Com Node 20.6+ também funciona `node --env-file=.env seed.js` (copie `.env.example` para `.env`).

## O que o `seed.js` faz
1. Valida os JSONs (array, `_id` string, sem duplicados, referências entre coleções).
2. Cria as 16 coleções com validação `$jsonSchema` em modo **warn** (avisa, não bloqueia gravações).
3. Cria índices (incluindo únicos que protegem contra estatística duplicada por partida/provedor).
4. Faz upsert por `_id` — pode ser executado quantas vezes quiser.

### Modo seguro (padrão) × `--force`
- **Seguro:** na coleção `players`, só os campos vindos da página do clube (nome, número, posição, `sourceRefs`, `lastVerifiedAt`...) são atualizados. Campos que você preencher depois (`birthDate`, `contract`, `statistics`, `fullName`...) **não são sobrescritos**. Veja `MANAGED_FIELDS` em `schema.js`.
- **`--force`:** sobrescreve todos os campos presentes nos JSONs.
- O seed **não remove** atletas que saíram do clube; se rodar de novo com um elenco novo, revise quem deixou de constar na página oficial.

## Conteúdo (`data/`)
| Arquivo | Docs | Observação |
|---|---|---|
| `players.json` | 35 | Elenco profissional da página oficial em 2026-11-07 (nome, número, posição) |
| `clubs.json` | 4 | Avaí + 3 adversários citados no calendário |
| `stadiums.json` | 3 | Ressacada, CFA João Nilson Zunino, Adolfo Konder (desativado) |
| `competitions.json` / `seasons.json` | 5 / 1 | Série B, Série C, Catarinense, Recopa, Copa SC / Série B 2026 |
| `matches.json` | 3 | Rodadas 36–38 da Série B 2026 (uma encerrada, duas agendadas) |
| `club_titles.json` | 9 | Títulos e conquistas, com `count` conferido contra a contagem declarada |
| `club_history.json` | 11 | Fatos históricos do clube |
| `sources.json` | 4 | Catálogo de fontes (a CBF está marcada `usedInLoad: false`) |
| demais | 0 | Vazios, prontos para dados verificados |

## Convenções adicionais desta carga
- `positionLabel`: texto exato da página do clube. `positionGroup`: normalização minha (`GK`, `CB`, `FB`=lateral, `DM`=volante, `MF`=meio-campo, `FW`=atacante); não indica função tática.
- `matches.date` sempre existe; `kickoffAt` só quando o horário foi publicado (fuso `-03:00`). `stadiumId` ficou `null`: a página não informa o local.
- Datas parciais em `club_history`: `datePrecision` = `year` | `month` | `day`.
- `createdAt` / `updatedAt` (ISO) são adicionados pelo seed.

## Pontos a validar
- A página de história lista 19 títulos estaduais, **sem 1992 e 1999**, mas a página da Ressacada cita finais no estádio nessas datas (Brusque/1992, Figueirense/1999) sob "títulos ganhos na Ressacada". Mantive a lista de títulos oficial; confirme com o clube se essas finais foram ganhas ou perdidas.
- `América Mineiro`: UF deixada `null` (a página não informa).
- Sem dados da base (Sub-20/17/15), contratos, idades, pé dominante ou estatísticas: nada foi estimado.
- Revalide elenco e situação dos atletas antes de qualquer decisão.

## Fontes
- Avaí — elenco: https://avai.com.br/futebol/profissional/
- Avaí — história e títulos: https://avai.com.br/clube/historia/
- Avaí — Ressacada: https://avai.com.br/clube/ressacada/
- CBF — Série B 2026 (complementar, não usada): https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-b/2026/20058?tab=atletas

## Widgets do SofaScore
A interface exibe widgets oficiais do SofaScore (iframes gratuitos) na ficha do atleta, na página do clube e no painel (Série B).
1. No sofascore.com, abra a página do atleta, time ou campeonato e use a opção de incorporar (embed).
2. Na interface, abra "Adicionar widget do SofaScore", cole o código do iframe (ou o link) e salve.

Só links `https://widgets.sofascore.com/...` são aceitos. O servidor guarda apenas o link validado na coleção `sofascore_widgets`. Quando o link traz o ID do SofaScore (ex.: `/player/971037`), ele é registrado em `externalIds.sofascore` da entidade.
Os números do widget pertencem ao SofaScore: não são gravados na base nem usados nas análises.

Testes: `npm test`.

## Atualização do elenco pelo site oficial do Avaí
```bash
npm run sync:avai               # coleta e grava
npm run sync:avai -- --dry-run  # mostra o que mudaria, sem gravar
npm run sync:avai -- --force    # reprocessa mesmo se o site não mudou
```
- Fonte: API WordPress pública do site do clube (`avai.com.br/wp-json/wp/v2/elenco-profissional`), que traz número, posição, nome completo, nascimento, naturalidade, altura e peso. O `robots.txt` do site libera a coleta. São 2 requisições por execução, e uma vez por dia basta (ex.: cron `17 6 * * *`).
- Cada campo guarda a origem em `fieldSources`. O site só sobrescreve campo vazio ou campo que ele mesmo gravou. Se outra origem já preencheu o campo com valor diferente, o valor atual é mantido e a divergência vai para `field_conflicts`.
- Atleta que sai da página não é apagado: vira `squadStatus: not_listed_on_official_page` e some da lista do elenco atual.
- Resposta idêntica à anterior não é reprocessada (hash em `raw_payloads`). Cada execução fica em `sync_runs`, com a lista de alterações.
- Depois da coleta, o vínculo de cada atleta com a ESPN é cruzado com o nome completo e a camisa oficiais (`crossCheck` em `player_season_stats`). O que diverge fica marcado como "conferir fonte" na interface.
- O `seed.js` agora só **insere** atletas novos e não sobrescreve os existentes (use `--force` para o comportamento antigo).

## Interface
`node server.js` e abra http://127.0.0.1:3000. Telas:
- **Análise:** Painel, Elenco atual, Perfil do elenco (profundidade por posição sobre o campo, idade, faixas etárias, utilização, origem e altura) e Comparador.
- **Prospecção:** Alvos de mercado e Relatórios.
- **Clube:** Modelo de jogo (identidade e requisitos por função) e História e títulos (com registro de fatos).
- **Dados:** Cadastro de atletas (inclusão, edição, importação por CSV) e Fontes e backup (exportação em JSON).

Os módulos da antiga página `legado.html` foram incorporados a essas telas e gravam direto no MongoDB.

## Assistente de IA (local, via Ollama)
A aba **Assistente de IA** usa um modelo de linguagem rodando na sua máquina, sem enviar dados para a nuvem.
```bash
# 1. instale o Ollama: https://ollama.com/download
ollama pull qwen2.5:7b      # baixa o modelo (uma vez, ~5 GB)
node server.js              # o Ollama precisa estar aberto
```
- Modos: treinos da semana, táticas para treinar, esquemas táticos, jogadas ensaiadas, escalação e pergunta livre, com perguntas de acompanhamento.
- A cada pedido o servidor monta um retrato do banco (elenco atual, estatísticas da Série B, idade, altura, modelo de jogo, requisitos por função, jogos, alvos e relatórios) e as limitações dos dados. O texto exato pode ser conferido em "Ver os dados enviados à IA".
- A IA é instruída a não inventar dados, citar os números que usa, separar conhecimento geral de futebol do que vem dos dados e terminar com "O que conferir antes de usar". Toda resposta aparece marcada como sugestão.
- As respostas ficam em `ai_sessions` e podem ser salvas em Relatórios (tipo "Sugestão da IA").
- Outro modelo ou endereço: `OLLAMA_MODEL=llama3.1:8b OLLAMA_URL=http://outra-maquina:11434 node server.js`. Modelos maiores (14B ou mais) costumam dar respostas melhores, mas pedem mais memória. O tamanho do contexto pode ser ajustado com `OLLAMA_NUM_CTX` (padrão 8192).
