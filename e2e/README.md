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

## Cobertura

- Landing, login, cadastro e feedback carregam.
- Rota interna sem sessão redireciona pro login (guarda de rota).
- Fluxo de convidado completo: login → personagem → seleção de mundo → jogo.
