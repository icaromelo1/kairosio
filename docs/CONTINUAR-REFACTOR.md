# Continuar o refactor (PixiJS → Babylon.js)

Ponto de partida de qualquer sessão nova sobre o refactor. Atualize este arquivo
ao fim de cada sessão: estado, decisões tomadas e próximo passo.

> Atualizado: 2026-10-19 (pontos 1 a 5 feitos).

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
| 1 | Limpeza do motor | feito |
| 2 | Base Babylon.js | feito |
| 3 | Escritório fixo | feito |
| 4 | Presença reconectada | feito (voz/vídeo sem teste com microfone real) |
| 5 | Personagem modular | feito |
| 6 | Edição de sala | futuro |

## Decisões (aprovadas pelo Icaro em 19/10/2026)

1. Estilo visual: low poly chapado. Pixelização, se vier, entra como pós-processo.
2. Câmera: ortográfica inclinada, fixa (ajustada para 48° nos testes).
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

## Como está montado

**Front (`kairos-ui/src/mundo/`)**, carregado só na rota do jogo por `import()`:
- `Mundo.ts`: cena Babylon (mão direita), câmera ortográfica a 48° que segue o jogador,
  luz ambiente + sol com sombra, piso e paredes gerados do mapa, mobília instanciada do
  `mobilia.glb`, pessoas (local e remotas, com interpolação), nomes em camada HTML,
  movimento com colisão, sentar, gestos, interação por proximidade e salas trancadas.
- `grade.ts`: paredes derivadas das salas (com vãos de porta) e grade de colisão de 0,25 m.
- `mobilia.ts`: catálogo das peças (pegada, sólida, sentável, estação).
- `audio.ts` + `bolhas.ts`: ganho de voz por distância e paredes, chamadas por sala fechada
  ou bolha de proximidade.
- `personagem/`: catálogo de slots e peças, `AvatarModelo` (instancia o `personagem.glb`,
  liga/desliga peças e pinta os materiais `tinta_*`), `previa.ts` (prévia do editor).
- `GamePage.vue` liga mundo, presença, mídia, jukebox e estações; `PersonagemPanel.vue` é o
  editor (obrigatório no primeiro acesso).

**Arte (`arte/`)**: `comum.py` (primitivas, esqueleto, skin rígido, ações NLA, exportação),
`mobilia.py` (21 peças) e `personagem.py` (corpo + 34 peças + 5 animações). Regerar com
`arte/gerar.sh` (Blender + `gltf-transform` weld/dedup/quantize → `kairos-ui/public/modelos/`).
Frente dos modelos = −Y no Blender. Convenção de ossos: rotação Z positiva leva o braço
direito para fora; negativa, o esquerdo. `personagem.py -- <pasta> --fotos` renderiza poses
para conferir.

**API**: mapa por `salas`/`mobilia` (`game_maps`), escritório oficial em `map/escritorio.ts`
semeado no boot (pulado se `editadoEm` preenchido); `characters.aparencia` (jsonb) validada em
`character/aparencia.ts` e reaproveitada pela presença; presença com `direcao` (ângulo) e
poses `parado|andar|sentar|acenar|dancar`.

## Testar na VM

- `scripts/vm-refactor.sh` sincroniza a branch para `~/projects/kairos-refactor` na VM,
  compila e sobe no pm2 `kairos-refactor-api` (porta 3100, banco `kairos_refactor`) e
  `kairos-refactor-ui` (vite preview na 4180, com proxy para a API).
- No Mac: `ssh -N -L 4180:127.0.0.1:4180 oracle-vm` e abrir `http://localhost:4180`.
- Contas de teste em `e2e/contas-teste.local` (fora do git): `teste1` e `teste2`, no
  servidor "Escritório Teste".
- Verificado no navegador em 19/10: login, editor obrigatório com prévia 3D, avatar no
  escritório, colisão, troca de sala, sentar/levantar, estação de tarefas criando tarefa,
  chat do mundo e um segundo usuário (bot) aparecendo com a aparência dele e andando.

## Pendências conhecidas

- **Voz e vídeo** foram religados (proximidade, chamadas por sala/bolha, ganho por parede),
  mas não testados com microfone e duas pessoas reais.
- **Poderes de sudo** (noclip, invisível, espectador, escala, festa, teleporte, puxar) e o
  controle da hora do mundo ficaram sem interface; os handlers do gateway continuam lá.
- **E2E**: `e2e/tests/smoke.spec.ts` ainda não roda contra a branch.
- **Bundle**: o Babylon sai em chunks separados, mas o loader de glTF puxa bastante código
  (cerca de 1,2 MB entre `transformNode` e `Mundo`). Vale revisar os imports do loader.
- **Corte para produção**: migration à parte que derruba `avatars`, `mascara_revisao`,
  `tile_revisao`, `world_state` e as colunas antigas de `characters`/`game_maps` no `appdb`.
- **Ponto 6** (edição de sala) é o próximo, quando o Icaro pedir.

## Fora do plano

- **Kanban integrado:** backlog de futuro distante. Não entra em plano, ponto
  nem documento de refactor. Só volta quando o Icaro pedir para lembrar.
- NPCs com LLM: backlog. Economia/dinheiro: recusado.

## Banco

- `synchronize` desligado; a API roda as migrations no boot (`migrationsRun: true`).
  Configuração em `kairos-api/src/database/opcoes.ts`, CLI pelo `data-source.ts`
  (`npm run migration:generate|run|revert`).
- Banco de teste do refactor: **`kairos_refactor`** no container `postgres` da VM (o mesmo
  do `appdb` de produção, dono `kairos`). Migrations aplicadas: `Inicial`,
  `MapaPorSalasEMobilia`, `AparenciaDoPersonagem`.
- Para rodar a CLI do Mac: `ssh -f -N -L 25432:127.0.0.1:5432 oracle-vm` e
  `DATABASE_URL=postgres://kairos:<senha do .env da VM>@127.0.0.1:25432/kairos_refactor`.

Gate usado: typecheck e build do front verdes; `tsc` e os 115 testes da API verdes;
`scripts/restos.mjs --catraca` sem regressão. O lint da API já reprovava antes do refactor
(prettier em quase todos os arquivos) e não é gate.

## Próximo passo

1. Testar voz e vídeo com duas pessoas reais na VM.
2. Decidir com o Icaro quando levar a branch para produção (exige a migration de corte).
3. Ponto 6, edição de sala, quando pedido.
