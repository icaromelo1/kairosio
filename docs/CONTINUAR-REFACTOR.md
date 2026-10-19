# Continuar o refactor (PixiJS → Babylon.js)

Ponto de partida de qualquer sessão nova sobre o refactor. Atualize este arquivo
ao fim de cada sessão: estado, decisões tomadas e próximo passo.

> Atualizado: 2026-10-19 (fim da sessão do ponto 1).

## Onde está cada coisa

- **Branch:** `main-refactor`, criada a partir da `main` em 19/10/2026. A `main`
  continua sendo a produção, com o motor PixiJS, até o refactor terminar.
- **Plano completo (fonte de verdade):** `kairos-ui/public/docs/refactor/index.html`,
  servido pelo jogo em `/docs/refactor/`. Tem a visão, os pontos em ordem, o
  inventário do que sai e do que fica, o que herdamos do Icarus Journey e as
  decisões em aberto, cada uma com a recomendação.
- **Referência técnica:** o Icarus Journey (`/Volumes/icaro_ssd/projetos/pessoal/icarusjourney`)
  já usa Babylon.js 9 com arte gerada por scripts Blender (`arte/LEIAME.md`,
  `arte/comum.py`, `arte/heroiBase.py`). Herdamos o processo, não o código.

## Objetivo

Kairos no estilo Gather, com o lado social do Discord, renderizado em Babylon.js.
O motor PixiJS sai inteiro, sem vestígio (código, assets, scripts, dependências
e tabelas do banco). Primeira entrega: **um escritório fixo e a personalização
completa do personagem** (roupas, cor de cabelo, cor de pele, sapatos, chapéus,
acessórios). A edição de sala vem depois.

## Pontos

| # | Ponto | Estado |
|---|---|---|
| 0 | Documento e branch | feito |
| 1 | Limpeza do motor | quase pronto: falta a migration inicial |
| 2 | Base Babylon.js | a analisar |
| 3 | Escritório fixo | a analisar |
| 4 | Presença reconectada | a analisar |
| 5 | Personagem modular (maior ponto) | a analisar |
| 6 | Edição de sala | futuro |

Regra de trabalho: cada ponto é analisado e escrito no `index.html` **antes** de
virar código, e só começa depois de o Icaro aprovar.

## Decisões (aprovadas pelo Icaro em 19/10/2026)

1. Estilo visual: low poly chapado. Pixelização, se vier, entra como pós-processo.
2. Câmera: ortográfica inclinada por volta de 55°, fixa.
3. `synchronize: true` sai na limpeza; o schema passa a ser só por migrations.
4. Produção fica na `main`; a branch roda só num ambiente de teste com banco separado.
5. Os mundos atuais das organizações somem; todos veem o mesmo escritório até o ponto 6.
6. Movimento livre com colisão contra uma grade lógica.


## Armadilhas já conhecidas

- Apagar uma entity com `synchronize: true` **não** apaga a tabela. `avatars`,
  `mascara_revisao` e `tile_revisao` ficariam órfãs, e `characters.avatarId` tem
  FK `RESTRICT` para `avatars`. A limpeza precisa de migration explícita.
- O `GamePage.vue` (cerca de 2.500 linhas) mistura o laço do Pixi com HUD, chat
  e mídia. Extrair os componentes de HUD primeiro e substituir a página, sem
  tentar limpar o arquivo.

## Fora do plano

- **Kanban integrado:** backlog de futuro distante. Não entra em plano, ponto
  nem documento de refactor. Só volta quando o Icaro pedir para lembrar.
- NPCs com LLM: backlog. Economia/dinheiro: recusado.

## Estado do ponto 1

Feito e commitado na `main-refactor`:
- Front: PixiJS, tiles, sprites, máscaras, editor, páginas de curadoria, `CharacterPanel`
  e a HUD do mundo apagados. `GamePage.vue` virou uma página enxuta: barra lateral,
  `ChatHud.vue` (chat extraído), painéis de servidores/admin/feedback/amigos e o aviso
  de sessão única. A presença entra num mapa fixo `escritorio` só para chat e online.
- API: módulos `avatar`, `mascara`, `tile` e `world`, mapas gerados e seed apagados.
  `map` ficou só leitura; `character` ficou só com a foto de perfil.
- Scripts, docs e e2e do motor antigo apagados; `pixi.js` removido.

Pendente neste ponto:
- **Migration inicial.** `kairos-api/src/database/` (data source + `opcoes.ts`) e os
  scripts `migration:*` estão prontos e **não commitados**: com `synchronize: false` e
  `migrationsRun: true`, a API só sobe depois que existir a migration inicial. Gerar com
  `npm run migration:generate -- src/database/migrations/Inicial` contra um banco vazio
  (`kairos_refactor` na VM, aprovação do Icaro pendente) e commitar tudo junto.
- **Corte para produção (só no fim do refactor):** uma migration à parte que derruba
  `avatars`, `mascara_revisao`, `tile_revisao`, `world_state`, as colunas antigas de
  `characters` e limpa `game_maps` no banco de produção.

Órfãos de propósito (religados depois): `JukeboxPanel`, `TaskPanel`, `NotePanel`,
`WhiteboardPanel` (ponto 3); `MediaStage`, `game/audio/calls.ts` e os emissores de
sudo/tela/avatar do `presence.ts` (ponto 4); `changeUsername` (ponto 5). A linha de base
do `scripts/restos.mjs` já conta com eles.

Gate: typecheck e build do front verdes; `tsc` e os 111 testes da API verdes. O lint da
API já reprovava antes do refactor (prettier em quase todos os arquivos) e não é gate.
O E2E de smoke ainda não rodou contra a branch.

## Próximo passo

1. Gerar e commitar a migration inicial (acima).
2. Subir a branch num ambiente de teste e rodar o smoke.
3. Detalhar o ponto 2 (base Babylon.js) no `index.html` e executar.
