# Continuar o refactor (PixiJS → Babylon.js)

Ponto de partida de qualquer sessão nova sobre o refactor. Atualize este arquivo
ao fim de cada sessão: estado, decisões tomadas e próximo passo.

> Atualizado: 2026-10-20 (pontos 1 a 5 feitos; mapa com jardim e funcionalidades do mapa antigo religadas).

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
- `Mundo.ts`: cena Babylon (mão direita), câmera ortográfica a 36° (inclinada, para ver a frente das coisas) que segue o
  jogador, iluminação separada dentro e fora do prédio (ver "Visual"), piso e paredes gerados do mapa, mobília instanciada do
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
`mobilia.py` (cerca de 56 peças) e `personagem.py` (corpo + 34 peças + 5 animações). Regerar com
`arte/gerar.sh` (Blender + `gltf-transform` weld/dedup/quantize → `kairos-ui/public/modelos/`).
`texturas.py` gera as texturas tileáveis de `kairos-ui/public/texturas/` (grama, gramado,
cascalho, pavimento, madeira, deck, carpete, ladrilho, reboco, variacao). Com `PINTAR=1`
(padrão do `gerar.sh`) cada peça ganha uma textura de detalhe de 256 px com AO, gradiente de
altura e brilho de bordas, como no Icarus.
Frente dos modelos = −Y no Blender. Convenção de ossos: rotação Z positiva leva o braço
direito para fora; negativa, o esquerdo. `personagem.py -- <pasta> --fotos` renderiza poses
para conferir.

**Verificação do personagem**: `arte/verificar_personagem.py -- <pasta> [--fotos] [--combinacoes]`
monta o modelo, confere catálogo × malhas × ossos × pesos × materiais de tinta × animações e mede,
em 8 quadros de cada animação, interseção entre peças de slots diferentes, partes do corpo entre
si e pés abaixo do chão (`relatorio.json`). `--fotos` renderiza cada peça em todas as poses e
`--combinacoes` cada par de slots que se encostam. Cabelo sob chapéu: cada cabelo tem as variantes
`_chapeu` (boné, gorro) e `_aba` (chapéu), achatadas na altura da aba; a peça do chapéu diz qual
usar em `corte`. Barba e bigode seguem a cor do cabelo (`semCor`). Poses: `parado`, `andar`,
`correr` (Shift), `sentar`, `acenar`, `dancar`.

**Bake de detalhe (`comum.pintar`)**: cada peça ganha cópia própria dos materiais compartilhados
(`<material>#<peça>`) e é assada sozinha (as outras ficam fora do render). Antes, todas as peças de
um material usavam a textura da última peça assada e o AO via peças sobrepostas — era a mancha
escura no rosto e nos móveis. No front, `AvatarModelo` pinta todos os materiais com o mesmo nome
base (antes do `#`).

**Editor**: miniaturas das peças em `kairos-ui/public/personagem/miniaturas/<slot>-<id>.webp`,
geradas por `arte/miniaturas.py` dentro do `gerar.sh`; prévia abre de frente em 3/4, gira
arrastando, zoom na roda e botão "rosto"; desfazer (botão e Ctrl+Z, 30 passos).

**API**: mapa por `salas`/`mobilia` (`game_maps`), escritório oficial em `map/escritorio.ts`
semeado no boot (pulado se `editadoEm` preenchido); `characters.aparencia` (jsonb) validada em
`character/aparencia.ts` e reaproveitada pela presença; presença com `direcao` (ângulo) e
poses `parado|andar|sentar|acenar|dancar`.

## Mapa atual (20/10)

`kairos-api/src/map/escritorio.ts`, 64 × 48 m. Prédio murado (`salao`, `aberta` + `murada`)
com 12 salas: duas de reunião, copa com jukebox, foco (estante de notas), ideias (lousa),
servidores, jogos (pingue-pongue, sinuca, fliperama), recepção com entrada pelo sul, duas
cabines e descompressão. No salão, 4 ilhas de 6 mesas e uma área de estar com TV. Em volta,
o jardim (`areas` do mapa: caminhos, praça de pedra, lago, deck, horta) com fonte, bancos,
postes, canteiros, árvores, mesas de piquenique, e cerca viva no limite do mapa. Spawn na
porta da recepção, do lado de fora. A mobília tem 37 peças (`arte/mobilia.py`).

Formato: `Sala.murada` desenha paredes numa sala aberta (o salão continua "área aberta" para
chat e voz); `Mapa.areas` são pisos externos (`agua` deixa lento); paredes no limite do mapa
viram cerca viva.

## Visual (20/10)

- Materiais PBR do glTF viram `StandardMaterial` (`mundo/materiais.ts`), com tonemapping
  ACES, FXAA, bloom leve e sharpen; contorno escuro em avatares e móveis.
- **Luz de fora:** céu (hemisférica) + sol com sombra de 4096 que acompanha o jogador, cor e
  força pela hora (`luz.ts`).
- **Luz de dentro:** conjunto próprio (`teto` direcional + `ambienteInterno` + sombra de
  2048). Sol e céu excluem as malhas internas (`excludedMeshes`), as luzes internas só
  pegam as internas (`includedOnlyMeshes`); cada sala ganha uma luz pontual na cor de
  `LUZ_DAS_SALAS`, só no piso dela. O avatar troca de conjunto ao entrar/sair
  (`atualizarZona`). As paredes do perímetro do prédio continuam com sol por fora.
- Pisos de sala e áreas com textura (`sala.textura`, `TEXTURAS_DE_AREA`).
- Lago em `mundo/lago.ts`: borda fina de pedras 3D irregulares (mescladas numa malha, com
  sombra e contorno), água abaixo da borda com parede interna à mostra, `ShaderMaterial`
  próprio (gradiente raso→fundo, cáusticas, ondas, espuma na margem, cor pela hora via
  `definirLuz`), vitórias-régias, lótus, juncos e carpas animadas.
- REA (github.com/morluto/rea) é um MCP de engenharia reversa (binários, apps JS/Electron,
  sites). Não foi instalado: o setup altera a config do agente e o Gather é 2D em pixel art,
  então o ganho para a arte 3D é pequeno. Instalar só com OK do Icaro.

## Funcionalidades do mapa antigo (conferidas em 20/10)

Religadas e testadas no navegador contra a VM:
- minimapa (M) com clique para ir até lá e duplo clique de sudo para teleportar;
- mapa grande (N) com a lista de salas e quantas pessoas há em cada uma;
- rota automática (A* em `mundo/rota.ts`) com cancelamento por tecla e replanejamento;
- salas com gente na barra lateral (duplo clique leva até a sala) e "andar até" da DM;
- tranca de sala (L) refletida na pílula da sala, na barra e no minimapa;
- luz pela hora de São Paulo (`mundo/luz.ts`) e hora travada por sudo;
- poderes de sudo: noclip, invisível, espectador, escala, festa, puxar, ir até, teleporte;
- última posição salva por usuário e mapa (localStorage), retomada se o ponto estiver livre;
- sentar em banco do jardim; estações, chat de sala e jukebox (já testados antes).
Implementadas sem teste visual: água deixa lento, colisão entre pessoas, arrastar a câmera
com Espaço, painel de atalhos (?).
Não voltou: spawnar item de sudo (escreve no mapa; entra com o ponto 6, edição de sala).

A conta `teste1` é sudo **só no banco de teste** (`kairos_refactor`).

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
- **LiveKit** responde com erro de CORS a partir de `localhost:4180`, então voz não dá para
  testar pelo túnel; precisa de um domínio de teste liberado no LiveKit.
- **E2E**: `e2e/tests/smoke.spec.ts` ainda não roda contra a branch.
- **Bundle**: o Babylon sai em chunks separados, mas o loader de glTF puxa bastante código
  (cerca de 1,2 MB entre `transformNode` e `Mundo`). Vale revisar os imports do loader.
- **Corte para produção**: migration à parte que derruba `avatars`, `mascara_revisao`,
  `tile_revisao`, `world_state` e as colunas antigas de `characters`/`game_maps` no `appdb`.
- **Ponto 6** (edição de sala) é o próximo, quando o Icaro pedir.
- O painel do navegador oculto roda a ~1 quadro por segundo; o movimento já se divide em
  passos de 0,05 s para não ficar lento nesse caso.

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
  `MapaPorSalasEMobilia`, `AparenciaDoPersonagem`, `AreasDoMapa`.
- Para rodar a CLI do Mac: `ssh -f -N -L 25432:127.0.0.1:5432 oracle-vm` e
  `DATABASE_URL=postgres://kairos:<senha do .env da VM>@127.0.0.1:25432/kairos_refactor`.

Gate usado: typecheck e build do front verdes; `tsc` e os 115 testes da API verdes;
`scripts/restos.mjs --catraca` sem regressão. O lint da API já reprovava antes do refactor
(prettier em quase todos os arquivos) e não é gate.

## Próximo passo

1. Testar voz e vídeo com duas pessoas reais na VM.
2. Decidir com o Icaro quando levar a branch para produção (exige a migration de corte).
3. Ponto 6, edição de sala, quando pedido.
