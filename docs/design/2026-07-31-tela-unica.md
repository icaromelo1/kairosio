# O jogo como tela única

> Design aprovado em 31/07/2026 (sessão de brainstorming).
> Reorganiza a entrada do produto: quem tem sessão cai direto no mundo, e as
> telas intermediárias viram painéis sobre ele — modelo Discord.
>
> Primeiro de três specs. Os outros: `2026-07-31-amigos.md` e
> `2026-07-31-mensagens-diretas.md`.

---

## Por que

Quem se cadastra hoje atravessa **cinco telas** até jogar: landing, login,
personagem, escolha de mundo e finalmente o jogo. Cada uma é uma rota própria,
com carregamento e navegação.

Duas dessas telas perderam a razão de existir com o que foi construído esta
semana. A **escolha de mundo** virou redundante: a barra lateral lista os mundos
com quem está em cada um, o que a página não fazia. E a tela de **servidores** só
aparece porque não há onde escolher servidor dentro do jogo — mas agora há, na
coluna da barra lateral.

O modelo que se quer é o do Discord: **uma interface só**. Você abre e está
dentro; escolher servidor, editar avatar e administrar são sobreposições, não
destinos.

---

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Estrutura | Jogo é a **tela única**; o resto vira painel | Pedido direto; elimina navegação entre páginas |
| Visitante sem sessão | **Landing enxuta** com "entrar" em destaque | Quem chega por link precisa saber o que é antes de criar conta |
| Quem tem sessão | **Nunca vê a landing** — cai no mundo | É o ganho principal |
| Editor de mapas | **Continua tela cheia própria** | Tem um canvas PixiJS inteiro; dois motores gráficos simultâneos é peso e bug garantidos |
| Escolha de mundo | **Deixa de existir** | A barra lateral faz melhor |

---

## O que vira painel

Sobre o jogo, sem trocar de rota:

- **Servidores** — criar, entrar por convite, escolher. Hoje é `/onboarding`.
- **Personagem** — editar avatar. Hoje é `/character`.
- **Administração do servidor** — hoje é `/admin`.
- **Feedback** — hoje é `/feedback`.

Todos abertos pela barra lateral, todos fechando com `Esc`, todos preservando o
jogo rodando atrás. O padrão visual já existe: a janela de mídia, o painel de
tarefas e o da lousa fazem exatamente isso.

**O editor é a exceção** e continua em rota própria (`/editor/:id`), em tela
cheia. Ele monta a própria cena PixiJS com paleta, ferramentas e grade; embutir
isso como painel significaria dois `Application` do Pixi vivos ao mesmo tempo,
disputando ticker e contexto de GPU.

## O que deixa de existir

- **`/map-select`** — a barra lateral cobre, com mais informação.
- **`/lab`** — bancada de testes do renderizador, hoje pública em produção
  (achado da auditoria de 31/07).

## Fluxo novo

```
sem sessão:   /  → landing enxuta → /login → jogo
com sessão:   /  → jogo  (a landing nem renderiza)
convite:      /join/<code> → login se preciso → jogo com o painel de servidores aberto
```

O destino pós-login deixa de ramificar entre `/character`, `/onboarding` e
`/map-select`: é sempre o jogo. O que muda é **qual painel abre junto**:

- sem personagem definido → painel de personagem aberto
- sem servidor e pode criar → painel de servidores aberto
- sem servidor e é convidado → nada aberto, joga nos mundos abertos
- com tudo pronto → nada aberto

Isso preserva a correção do beco sem saída feita em 30/07: convidado nunca fica
preso em tela nenhuma, porque não há mais tela onde ficar preso.

## A landing

Curta: o que é o Kairos, uma imagem ou demonstração do mundo, e "entrar" em
destaque. Sem rolagem longa, sem seções de marketing empilhadas.

A landing atual já foi reescrita uma vez e tem conteúdo bom — o trabalho aqui é
**cortar**, não escrever do zero, e garantir que quem tem sessão seja desviado
antes de ela renderizar.

---

## Fora de escopo

- **Refazer a identidade visual** da landing. O trabalho é de estrutura e corte.
- **Modo demonstração** para visitante (andar no mundo sem conta) — avaliado e
  descartado: é bem mais obra e expõe o motor a qualquer um.
- **Embutir o editor** como painel, pelo motivo técnico acima.
- **Atalhos de teclado** para os painéis novos, além do `Esc` para fechar.

## Riscos

| Risco | Mitigação |
|---|---|
| Painéis empilhados virando bagunça (personagem sobre servidores sobre admin) | Um painel por vez: abrir um fecha o outro. O `Esc` sempre fecha o de cima |
| Teclado do jogo respondendo com painel aberto | O `GamePage` já ignora teclas quando o alvo é campo de texto; os painéis precisam entrar nessa mesma regra, e o movimento congela com painel aberto (já é o comportamento com modal) |
| Perder o acesso a algo que só existia na rota removida | Antes de apagar `/map-select`, conferir o que ela oferece que a barra lateral não tem — o botão de criar mundo e o link de editar mundo próprio precisam ter destino novo |
| Rota antiga em favorito de alguém | `/map-select` e `/lab` passam a redirecionar para o jogo em vez de dar erro |

## Como validar

1. **Sessão válida:** abrir a raiz cai no jogo, sem passar pela landing.
2. **Sem sessão:** abrir a raiz mostra a landing; "entrar" leva ao login; login
   leva ao jogo.
3. **Conta nova:** cadastro leva ao jogo com o painel de personagem aberto.
4. **Convidado:** entra e joga nos mundos abertos, sem painel obrigatório.
5. **Convite:** abrir `/join/<code>` termina no jogo com o servidor já aplicado.
6. **Painéis:** abrir cada um, fechar com `Esc`, confirmar que o personagem não
   anda enquanto estão abertos e que o jogo continua rodando atrás.
7. **Rotas removidas:** `/map-select` e `/lab` redirecionam em vez de quebrar.
