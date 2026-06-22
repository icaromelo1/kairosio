# Plano — Melhorar a landing page

> Origem: Icaro — a landing precisa **explicar melhor o que o jogo é, como usar e pra que
> serve / como pode ser útil**. Status: planejado. Base: já existe `LandingPage.vue` em `/`.

---

## 1. Objetivo
Quem cai na landing (`icaromelodev.com.br/kairos`) deve entender em segundos:
1. **O que é** o Kairos.
2. **Como usar** (passo a passo).
3. **O que dá pra fazer** (recursos).
4. **Pra que serve** (casos de uso / utilidade).
E ter um **CTA claro** pra entrar.

## 2. Seções propostas

### Hero
- Frase curta + forte: ex. "Seu espaço virtual em pixel art — junte o time num mundo só."
- Subtítulo: "Um Gather.town em pixel art: avatares, salas, chat e voz por proximidade — e
  você cria os próprios mundos." + botão **Entrar / Criar conta**.
- Visual: print/gif do jogo (avatares andando num mundo).

### O que é
- 2–3 linhas: espaço virtual multiusuário, por organização/equipe, onde cada um tem um avatar
  e interage por proximidade (chat, voz), num mundo pixel art que dá pra editar.

### Como usar (passo a passo, com ícones)
1. Crie uma conta (ou entre como convidado pra experimentar).
2. Crie/entre numa **organização** (sua equipe).
3. Monte seu **avatar**.
4. Escolha um **mundo** e entre.
5. **Ande** (WASD), **converse** (chat), **fale** (voz por proximidade), **acene/dance**.
6. **Crie seu próprio mundo** no editor.

### O que dá pra fazer (recursos)
- Mundos multiusuário em tempo real (presença, colisão).
- **Chat** e **voz por proximidade** (WebRTC).
- **Editor de mundos** (colocar objetos, redimensionar, salvar).
- **Organizações/times** — cada org só vê os próprios mundos.
- Customização de avatar; emotes.

### Pra que serve (casos de uso / utilidade)
- **Escritório virtual / home office** — equipe remota "junta" num espaço.
- **Eventos / encontros** — salas temáticas, conversas por proximidade.
- **Salas de estudo / coworking** — foco compartilhado.
- **Socialização de times** — happy hour, dinâmicas, onboarding.

### CTA final
- "Crie sua organização e chame o time" + botão.

## 3. Tarefas
1. Reescrever `LandingPage.vue` com as seções acima (copy + layout). — *médio*
2. Capturar **screenshots/gif reais** do jogo pros visuais (hero + recursos). — *conteúdo*
3. Ajustar o CTA pro novo fluxo (login → onboarding de org). — *quick-win*
4. Responsivo (mobile).

## 4. Critérios de aceite
- Em 10s a pessoa entende o que é, como usar e pra que serve.
- CTA leva ao login/cadastro; visuais reais (não placeholder).

## 5. A confirmar
- Tom: mais "produto/SaaS" (B2B times) ou mais "joguinho/social"? (a multi-tenancy puxa pro B2B)
- Incluir seção de preço/planos no futuro? (hoje não)
