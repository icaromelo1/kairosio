# Kairos E2E (Playwright)

Smoke tests do fluxo principal, rodando contra o ambiente publicado.

## Rodar

```bash
cd e2e
npm install
npm run install:browsers   # baixa o Chromium do Playwright (1ª vez)
npm test                   # roda contra https://icaromelodev.com.br/kairos
```

Para apontar pra outro ambiente:

```bash
KAIROS_URL=http://localhost:9000 npm test
```

Typecheck (o `npx tsc` aqui baixava um pacote `tsc` falso — usar sempre o script):

```bash
npm run typecheck
```

## Cobertura

- Landing, login e cadastro carregam.
- Rota interna sem sessão redireciona pro login (guarda de rota).
- Fluxo de convidado: login → jogo direto.
- Rotas antigas (`/map-select`, `/feedback`) caem no jogo em vez de quebrar.
- Sessão de mídia: dois navegadores no mesmo mundo trocam áudio de verdade
  pelo SFU (`media.spec.ts`).

## Sessão de mídia

```bash
npm run test:midia
```

Sobe dois contextos do Chromium com microfone sintético
(`--use-fake-device-for-media-stream`), cria duas contas pela API real, entra no
mesmo mundo e mede o RTP.

A prova não vem da UI: os elementos de áudio do LiveKit nunca entram no DOM, e
"conectado" na tela não significa que áudio chegou. O teste embrulha o
`RTCPeerConnection` antes do app carregar e lê `getStats()` — o que ele afirma é
que saíram e chegaram bytes de `inbound-rtp`/`outbound-rtp` de áudio, com par de
candidatos ICE em `succeeded` nos dois lados.

Autoteste — prova que o gate consegue falhar:

```bash
npm run test:midia:autoteste
```

Só o cliente A abre o microfone. O esperado é **falhar** em "A recebeu áudio do
SFU" com `entrada: 0`. Se passar, o teste está medindo o nada.

Cada execução cria duas contas `midia.<marca>@e2e.local` no banco do ambiente
apontado. Não há endpoint de auto-exclusão — limpar depois:

```sql
DELETE FROM kairos.users WHERE email LIKE 'midia.%@e2e.local';
```
