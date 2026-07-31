# Auditoria do Kairos — 31/07/2026

Varredura atrás de código morto, features pela metade, falhas de segurança e
arestas de usabilidade. Tudo verificado contra o código e, onde fazia sentido,
testado em produção.

---

## Resumo

| # | Achado | Tipo | Severidade | Esforço |
|---|---|---|---|---|
| 1 | Janela de voz minimizada come os eventos da câmera | usabilidade | **alta** | baixo |
| 2 | Login sem freio contra tentativa em massa | segurança | **alta** | baixo |
| 3 | `/auth/guest` enche o banco sem limite | segurança | **alta** | baixo |
| 4 | Botão "◇ logos" não faz nada | morto | média | trivial |
| 5 | Contador "1 online" duplica a barra lateral | usabilidade | média | trivial |
| 6 | `/lab` — página de desenvolvimento pública | exposição | média | trivial |
| 7 | Login com Google/GitHub prometido e não entregue | incompleto | média | — |
| 8 | Editar nota: endpoint e função existem, ninguém usa | morto | baixa | baixo |

**Verificado e sem problema:** rotas públicas (todas intencionais), upload de foto
(5 MB, tipo validado, path traversal fechado), payload grande (rejeitado com 413),
XSS (nenhum `v-html` no projeto), contrato de eventos entre servidor e cliente.

---

## 1. A janela de voz minimizada come os eventos da câmera

**O que acontece:** ao minimizar a janela, ela vira uma faixa que continua no meio
da tela. Arrastar a câmera ou dar zoom com o cursor sobre aquela faixa não
funciona — parece que a câmera travou.

**Por quê:** o cálculo do quadro zera a altura ao minimizar, mas **mantém a
largura da janela cheia**:

```ts
width:  `${frame.w}px`,                                  // ~780px, mesmo minimizada
height: minimized.value ? undefined : `${frame.h}px`,
```

Com `position: fixed` e `z-index: 60`, sobra uma faixa larga sobre o canvas
interceptando tudo que passa por ali.

**Correção:** minimizar deve **esconder** a janela. A barra lateral já mostra quem
está na chamada e já tem os controles de microfone e som no rodapé — a faixa
flutuante é redundante e atrapalha. Some a janela, fica a barra lateral.

## 2. Login sem freio contra tentativa em massa

**Testado em produção:** 10 tentativas seguidas de senha errada, todas
respondidas com 401, **nenhuma bloqueada**.

O limite global é de 120 requisições por minuto por IP, aplicado igualmente a
tudo. Para `/auth/login` isso significa **172 mil tentativas de senha por dia**
contra uma conta conhecida.

**Correção:** limite próprio e agressivo no login — algo como 5 a 10 tentativas
por minuto, contadas **por email alvo** e não só por IP, com atraso progressivo.
O `ThrottlerModule` já está no projeto e aceita configuração por rota.

## 3. `/auth/guest` enche o banco sem limite

Cada clique em "entrar como convidado" **cria uma linha na tabela de usuários**.
Testado: 5 chamadas seguidas, 5 usuários criados, nenhum bloqueio. No limite
atual dá para criar ~172 mil contas por dia.

Não é roubo de dado — é entupimento de armazenamento, e envenena qualquer
métrica de uso que você venha a olhar.

**Correção:** limite específico e baixo nessa rota, e uma limpeza periódica de
convidados sem atividade (a conta já é apagada no logout, mas quem fecha a aba
sem sair fica para sempre).

## 4. O botão "◇ logos" não faz nada

Na tela de login existe um botão `◇ logos` que executa `showLogosModal = true`.
**Não existe nenhum modal no template que reaja a essa variável** — as únicas
duas menções no arquivo são o botão e a declaração da variável.

Clicar não produz efeito algum. É resto de uma tela de escolha de logotipo que
não sobreviveu.

**Correção:** remover o botão e a variável.

## 5. O contador "1 online" duplica a barra lateral

O bloco no canto superior direito mostra quantos estão online e a lista de nomes.
A barra lateral nova mostra **a mesma informação**, por mundo e por servidor, com
mais contexto. Dois lugares dizendo o mesmo, e um deles não dá para fechar.

**Correção:** remover o bloco do canto. A barra lateral cobre o caso, e o HUD
volta a ser só o que é do jogo (nome, mundo, teclas).

## 6. `/lab` — página de desenvolvimento pública

A rota `/lab` (título interno: *"Lab · Mapa + Avatar (PixiJS)"*) é uma bancada de
testes do renderizador. Ela **não tem guarda de rota** e responde 200 em produção:

```
https://icaromelodev.com.br/kairos/lab → HTTP 200
```

Ela busca a lista de mundos e monta cena e avatar. Não vaza dado de outra pessoa
— a API continua exigindo autenticação — mas é superfície que ninguém precisa, e
uma porta para o motor gráfico que não deveria estar aberta.

**Correção:** remover a rota, ou trancá-la atrás de autenticação e de uma
verificação de administrador.

## 7. Login com Google/GitHub prometido e não entregue

A tela de login tem os dois botões, e clicar em qualquer um deles responde
*"Login com Google/GitHub em breve"*.

O engraçado é que **o backend está pronto**: as duas estratégias existem, as
rotas `/auth/google` e `/auth/github` estão implementadas, e o callback que troca
o código pelo token também. O registro é condicional:

```ts
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) …
```

Sem as credenciais, as rotas simplesmente não sobem.

**Duas saídas, e a escolha é sua:** criar os aplicativos no Google Cloud e no
GitHub e colar as credenciais no `.env` do servidor — e aí o front troca o "em
breve" por links reais, trabalho de minutos; ou **esconder os botões** enquanto
isso não acontecer. Botão que promete e não cumpre é pior que botão ausente.

## 8. Editar nota: existe no servidor, ninguém usa

O endpoint `PATCH /note/:id` está implementado e a função `updateNote()` está
exportada no cliente. **Nada no aplicativo chama nenhum dos dois** — o painel de
notas só cria e apaga.

**Correção:** ou usar (dar edição à nota, que é o esperado de uma nota) ou
remover os dois. Manter código que nunca roda é dívida que passa em toda revisão
sem ninguém notar.

---

## O que foi verificado e está correto

**Rotas públicas** — quatro no total, todas intencionais: os endpoints de
autenticação, a foto do personagem e o áudio do jukebox (que o navegador busca
por `<img>` e `<audio>`, sem cabeçalho de autenticação), e a listagem de feedback
com email mascarado.

**Upload de foto** — teto de 5 MB, tipo conferido por lista fechada, e o nome do
arquivo validado por expressão regular antes de tocar no disco, o que fecha
travessia de diretório.

**Payload grande** — um mapa com 5.000 objetos (324 KB) é rejeitado com 413 pelo
limite padrão do Express.

**XSS** — nenhum `v-html` ou `innerHTML` no projeto; tudo passa pela interpolação
do Vue, que escapa por padrão.

**Contrato de eventos** — os 16 eventos que o servidor emite batem exatamente com
os que o cliente escuta.

---

## Ordem sugerida

**Primeiro, o que o uso real expôs (1 e 5):** minimizar esconde a janela, e sai o
contador duplicado. São os dois que incomodam a cada sessão.

**Depois, os freios (2 e 3):** limite no login e no convidado. Baixo esforço,
fecha os dois vetores de abuso.

**Depois, a faxina (4, 6, 8):** botão morto, página de laboratório e a edição de
nota que nunca existiu.

**Por último, decidir sobre o 7:** OAuth é a única que depende de você criar
credenciais fora do projeto.
