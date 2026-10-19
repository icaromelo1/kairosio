# Kairos

Espaço virtual no estilo Gather, com o lado social do Discord. Monorepo:
`kairos-ui` (Vue 3 + Quasar), `kairos-api` (NestJS + TypeORM + Postgres),
`kairos-configs` (Docker Compose + LiveKit).

## Refactor em andamento

O motor PixiJS está sendo trocado por Babylon.js na branch `main-refactor`.
Antes de qualquer trabalho no refactor, ler `docs/CONTINUAR-REFACTOR.md` (estado
e próximo passo) e `kairos-ui/public/docs/refactor/index.html` (plano completo).

## Regras

- Toda documentação, estratégia e decisão do projeto fica **dentro deste repositório**,
  para outra sessão continuar daqui. Ao fim de uma sessão, atualizar
  `docs/CONTINUAR-REFACTOR.md`.
- Kanban é backlog de futuro distante: não entra em plano nem documento, e só
  volta quando o Icaro pedir para lembrar.
