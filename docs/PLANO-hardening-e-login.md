# Plano — Blindagem de campos de texto + refinamentos de login real

> Status: planejado (alguns quick-wins já feitos). Prioridade: média-alta (entra junto com
> o login real / multi-tenancy).

---

## 1. Auditoria de campos de texto

Revisar **todos** os inputs: limite de tamanho, `trim`, e sanitização/escape.

| campo | onde | estado | a fazer |
|---|---|---|---|
| Chat da sala | GamePage | maxlength 300 ✓ | confirmar escape (Vue escapa por padrão no `{{ }}` — OK; garantir que nada use `v-html`) |
| Nome do personagem | CharacterPage | maxlength 20 + trim ✓ | bloquear caracteres de controle/emoji-bomba se necessário |
| Nome do mundo | EditorPage | — | maxlength (ex: 40) + trim; backend já valida no DTO (2–40) |
| Título/descrição feedback | FeedbackPage | DTO valida ✓ | confirmar maxlength no front (espelhar o DTo: 120/2000) |
| Email/senha | Login/Register | regex/minlength ✓ | ok |

Regra geral: **maxlength no front + validação no DTO do backend** (defesa em profundidade).
Nunca renderizar conteúdo de usuário com `v-html`.

---

## 2. Nome do personagem "cacheando" — corrigir com login real

**Problema atual:** o `characterStore` persiste no `localStorage` (`kairos_character`) de
forma **genérica** — não amarrado ao usuário. No mesmo navegador, trocar de conta mostra o
nome/avatar da conta anterior até o usuário mudar.

**Correção (com login real):**
- Ao **logar**: chamar `getCharacter()` do DB e **sobrescrever** o store (já acontece no
  CharacterPage; garantir que rode logo no login, não só ao abrir a tela de personagem).
- Ao **deslogar** (`authStore.logout`): **limpar** `localStorage.kairos_character` e resetar o
  store pros defaults (senão vaza pro próximo usuário).
- Opcional: trocar a chave do localStorage por algo por-usuário (`kairos_character_<userId>`),
  mas o DB já é a fonte da verdade — limpar no logout resolve.

---

## 3. Login real — itens restantes

- **OAuth Google/GitHub**: código pronto e env-gated. Falta o Icaro criar os apps OAuth e
  por no `.env` do servidor: `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`
  (+ `FRONT_URL` se quiser custom). Ao configurar, trocar os botões "em breve" por links
  reais (`/kairos-api/auth/google` e `/github`).
- **Hidratar estado ao logar**: personagem + último mundo/posição (já existe, revisar o
  momento da chamada).
- **Convidado**: não cria mundo (feito). Avaliar limitar mais ações do convidado conforme
  a multi-tenancy entrar (convidado não tem org).

---

## 4. Voz / microfone (WebRTC) — feedback (instável + pouco claro)

**Problemas relatados:** às vezes precisa **desconectar/reconectar o mic** pra funcionar; e
o controle do microfone **não está claro** (tem o botão embaixo, mas o usuário não percebe).

**A fazer:**
- [ ] **Clareza do controle**: botão de mic maior/rotulado ("Falar por voz"), com estado
      visível (ligado/desligado), e uma dica curta na 1ª vez ("aproxime-se de alguém pra falar").
- [ ] **Confiabilidade**: hoje só o de id "menor" inicia a oferta (anti-glare) e a conexão é
      tentada no `sync` por frame. Investigar: (a) renegociar quando o OUTRO liga o mic depois
      (hoje não há gatilho); (b) reconectar peer em `iceConnectionState=failed`; (c) garantir
      `getUserMedia` antes de tentar conectar. Possível: ao ligar o mic, forçar re-sync de
      todos os peers próximos (drop+reconnect) em vez de esperar o frame.
- [ ] Indicador de "quem está falando" (nível de áudio) — além do 🔊 de conectado.

---

## Critérios de aceite
- Nenhum input aceita texto além do limite; nada renderizado via `v-html`.
- Trocar de conta no mesmo navegador não vaza nome/avatar da conta anterior.
- (quando configurado) login social funciona e cai logado no personagem.
- Voz: o usuário entende como ligar o mic; conexão estabelece sem precisar reconectar manual.
