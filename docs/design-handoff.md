# Handoff: Elenco atual e Resumo da temporada

## Visão geral
Telas de consulta do elenco profissional do Avaí, lendo o MongoDB via `GET /api/state`. Uso principal: o analista abre a lista, compara números de jogo e abre a ficha de um atleta. As áreas de prospecção (alvos de mercado, comparador) ficam reservadas na navegação e usam o mesmo shell.

## Layout
Grade de duas colunas: trilho lateral (`rail-w`) e página. Página = cabeçalho (título e linha de contexto) + conteúdo. A ficha do atleta abre como painel lateral sobre a página.
A lista é uma tabela única, agrupada por posição (Goleiros, Zagueiros, Laterais, Volantes, Meias, Atacantes) enquanto a ordenação for "Posição". Ordenar por qualquer outra coluna remove os grupos. Motivo: o grupo reproduz a súmula do clube; a ordenação por número libera a leitura de rankings.

## Tokens (`css/tokens.css`)
| Token | Valor | Uso |
|---|---|---|
| `c-club` | #0a4d8c | Único acento: número da camisa, item ativo, foco |
| `c-ink` / `c-ink-2` / `c-ink-3` | #18212b / #566270 / #78848f | Texto, texto de apoio, dado ausente |
| `c-paper` / `c-ground` | #fff / #f1f3f5 | Superfícies / fundo e linhas de grupo |
| `c-rule` / `c-rule-strong` | #d9dee3 / #b9c1c9 | Divisórias / cabeçalho de tabela e controles |
| `c-flag` / `c-flag-bg` | #8a5700 / #fbf0d5 | Aviso de dado a conferir |
| `font-ui` | Barlow 400/500/600, números tabulares | Todo o texto |
| `fs-1…4` | 12 / 14 / 16 / 22 px | Apoio, corpo, destaque, título |
| `sp-1…6` | 4 / 8 / 12 / 16 / 24 / 32 px | Espaçamento |
| `row-h`, `drawer-w`, `t-fast` | 38 px, 420 px, 160 ms | Linha, painel, transição |

## Componentes
| Componente | Props / dados | Notas |
|---|---|---|
| Linha de atleta | `shirt, name, position, group, apps, starts, goals, assists, yellow, red, review` | Nome é botão que abre a ficha. Valor ausente: "—" em `c-ink-3` |
| Cabeçalho ordenável | `aria-sort` | Colunas numéricas começam em ordem decrescente; Nº e texto, crescente |
| Selo "conferir fonte" | `review` | Atleta cujo nome ou camisa na ESPN diferem do clube |
| Ficha do atleta | `official, asOf, review, club, birth, height, foot, status` | Mostra só as métricas existentes; goleiros trazem defesas e gols sofridos |
| Resumo | soma e rankings (top 5) | Rankings omitem quem tem zero; sem registros mostra "Sem registros." |

## Estados
| Elemento | Estado | Comportamento |
|---|---|---|
| Página | Carregando | "Carregando elenco…" no centro |
| Página | Erro | Mensagem de causa provável e botão "Tentar de novo" |
| Página | Vazio | Orienta rodar `node seed.js` |
| Tabela | Filtro sem resultado | Linha única "Nenhum atleta encontrado com esse filtro." |
| Cabeçalho, nome, selects | Foco por teclado | Contorno 2 px em `c-club` |
| Painel | Aberto | Fundo escurecido; Esc, clique fora ou "Fechar" encerram e devolvem o foco ao nome clicado |

## Responsivo
| Faixa | Mudança |
|---|---|
| > 900 px | Trilho lateral fixo; tabela com cabeçalho fixo e rolagem interna |
| ≤ 900 px | Trilho vira barra horizontal no topo; itens "em breve" ocultos; busca em largura total; tabela rola na horizontal (largura mínima 680 px) |
| ≤ 440 px | Painel ocupa a tela inteira |

## Casos de borda
- **Dados ausentes:** nunca exibir zero no lugar de "não informado". Minutos não existem na fonte atual e não aparecem.
- **Nomes longos:** a coluna do atleta não quebra linha; a tabela rola.
- **Atleta sem estatísticas** (Pedro Cuiabá, Gaspar): linhas com "—" e ficha informando a ausência.
- **Textos maiores (outros idiomas):** colunas não têm largura fixa, exceto Nº.

## Movimento
| Elemento | Gatilho | Animação | Duração | Easing |
|---|---|---|---|---|
| Painel | Abrir/fechar | Desliza da direita | 160 ms | ease-out |
| Fundo escurecido | Abrir/fechar | Opacidade | 160 ms | linear |
Sem animação na carga da página. Com `prefers-reduced-motion`, ambos mudam sem transição.

## Acessibilidade
- Ordem de foco: link "Ir para o conteúdo", navegação, busca, filtro, cabeçalhos, nomes dos atletas.
- Tabela com `th scope="col"` e `aria-sort`; painel com `role="dialog"`, `aria-modal` e título ligado por `aria-labelledby`.
- Teclado: Enter ou Espaço abrem a ficha; Tab fica preso no painel; Esc fecha.
- `main` é `aria-live="polite"`, então a troca de tela é anunciada.

## Fonte de dados (campo da API → exibição)
`official.appearances` Jogos · `official.startsDerived` Titular (derivado: jogos − entradas como reserva) · `official.goals/assists` · `official.yellowCards/redCards` · `shirt` ← `shirtNumber` · `group` ← `positionGroup`.

## Em aberto para a parte de scout
Alvos de mercado, comparador e relatórios continuam na versão anterior (`/legado.html`). Quando migrarem: reutilizar a tabela, a ficha e o painel; relatórios vão para `scouting_reports` com `authorType`, `evidenceRefs`, `confidence` e `limitations` visíveis.

---

# Atualização 2: painel, comparador, clube e modo escuro

## Telas
| Tela | Para quem | Conteúdo (coleção) |
|---|---|---|
| Painel | Diretoria, comissão | Calendário e resultado (`matches`); dispersão jogos × gols+assistências; artilharia, assistências, cartões, elenco por posição; completude do cadastro e fontes (`sources`) |
| Elenco atual | Comissão, atletas | Tabela por posição; ficha com cadastro, totais e **ritmo por jogo** |
| Comparador | Técnico, auxiliares | Dois atletas lado a lado: totais e taxas por jogo, barras espelhadas |
| Clube | Todos | Dados do clube e da Ressacada (`clubs`, `stadiums`), faixa de títulos por temporada (`club_titles`), linha do tempo (`club_history`) |

## Componentes novos
| Componente | Regras |
|---|---|
| Dispersão | x = jogos, y = gols + assistências; marcador com camisa; cor por posição (`g-gk…g-fw`); atletas no mesmo ponto são deslocados 15 px; clicável e acessível por teclado |
| Barras horizontais | Rótulo, barra, valor. Cartões empilham amarelo e vermelho; sempre com legenda em texto |
| Ritmo por jogo | Barra na escala do elenco (atletas com 5+ jogos) e marca vertical na média da posição. Menos de 5 jogos exibe aviso |
| Comparador | Barras espelhadas normalizadas pelo maior valor da linha; destaque no líder, exceto em cartões, faltas cometidas e gols sofridos |
| Faixa de títulos | Uma marca por temporada em 1920–2030; vice-campeonato com marca vazada |

## Modo escuro
Tokens redefinidos em `:root[data-theme='dark']` (azul-ardósia, acento `c-club` claro). O tema inicial vem do sistema e a escolha fica salva no navegador. Contraste dos marcadores: `c-on-dot` (branco no claro, ardósia no escuro). Cores de posição têm variante clara e escura. O botão fica no fim do trilho.

## Estados e bordas adicionais
- Sem partidas, sem estatísticas ou sem títulos: texto curto no lugar do gráfico, nunca gráfico vazio.
- Comparador sem dois atletas: instrução. Posições diferentes: aviso.
- Sem minutos na fonte: taxas por jogo, com a ressalva visível na tela.
- Link de fonte da linha do tempo só aparece se começar com http ou https.

## Ainda não usam dados (coleções vazias)
`contracts`, `player_match_stats`, `scouting_reports`, `observations`, `tactical_profiles`, `obsidian_documents`. Quando houver dados: contratos e vencimentos no Painel e na ficha; estatísticas por partida na ficha (forma recente); relatórios e observações na ficha, com autoria, evidência, confiança e limitações.
