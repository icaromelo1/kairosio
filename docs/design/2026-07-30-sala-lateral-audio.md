# Barra lateral no modelo Discord e áudio contínuo

> Design aprovado em 30/07/2026 (sessão de brainstorming).
> Reconstrói a barra lateral em duas camadas — servidores e mundos, com as pessoas
> visíveis — e faz o áudio conectar sozinho ao entrar num mundo, lembrando o
> estado anterior do microfone.
>
> **Depende de `2026-07-30-servidores.md`**, que define o vocabulário e os
> endpoints de servidor. Implementar depois dele.

---

## Por que

A barra lateral de hoje lista os mundos e diz qual é o atual. Ela não mostra
**quem** está em cada um, e o servidor é uma escolha escondida: para trocar,
é preciso passar pela tela de onboarding.

O modelo que se quer é o do Discord, com uma diferença importante que ficou
explícita no brainstorming: **navegar não é conectar**. No Discord você clica
noutro servidor, olha os canais dele e continua conectado na voz de onde estava —
o rodapé lembra onde você está. Só ao clicar num canal é que você muda.

O áudio hoje é opt-in a cada sessão: entrar na voz é um clique, e o estado não
sobrevive à troca de mundo nem à volta no dia seguinte.

---

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Estrutura | Duas camadas: **servidores** (coluna estreita) e **mundos** (lista) | Hierarquia do Discord, pedida diretamente |
| Navegar entre servidores | **Não desconecta** | Olhar outro servidor sem perder onde se está é o comportamento do Discord e o que o Icaro descreveu |
| Trocar de mundo | Clique no mundo faz a troca **inteira** (servidor + mundo) | Sem tela intermediária |
| Pessoas por mundo | **Nomes aninhados**, com colapsar por mundo | Combinação das opções 1 e 3 apresentadas |
| Atualização | **Evento**, não polling | Com polling de 8s a lista fica sempre atrasada e não parece o Discord |
| Áudio ao entrar | **Conecta sozinho** | Pedido direto |
| Microfone na primeira vez | **Desligado** | Ninguém é ouvido sem ter clicado uma vez |
| Depois da primeira vez | **Lembra o último estado** | Pedido direto |

---

## Parte 1 — Barra lateral

### Estrutura

```
┌───┬──────────────────┐
│▪▪ │ KAIROS ADM   ▾   │   ← servidor sendo exibido
│▪▪ ├──────────────────┤
│   │ ▾ Studio      3  │
│□□ │   ● Icaro   🎙   │
│□□ │   ● Bruno   🔇   │
│ 2 │   ● Ana          │
│   │ ▾ Ágora       1  │
│□□ │   ● Luiz    🖥   │   ← transmitindo
│□□ │ ▸ Ateneu      0  │   ← vazio, colapsado
│   ├──────────────────┤
│ + │ 🧍 Icaro  🎙 🔊 ⚙ │   ← personagem e controles
└───┴──────────────────┘
```

**Coluna de servidores:** um bloco por servidor de que se é membro, com as
iniciais do nome (arte por servidor está fora de escopo) e um badge com quantas
pessoas estão online nele. O `+` no fim entra noutro servidor por convite.

**Lista de mundos:** mundos do servidor **sendo exibido**, cada um com as pessoas
dentro. O mundo em que se está nasce expandido; os vazios nascem colapsados; a
escolha de colapsar persiste por mundo.

**Rodapé:** o personagem, com atalho direto para editar o avatar — hoje isso está
perdido no meio das ações — e os controles de microfone e som.

### Navegar sem desconectar

Clicar num servidor **apenas troca o que a lista exibe**. O avatar continua onde
está, a voz continua conectada, e o rodapé mostra onde se está de fato, com um
atalho para voltar. Só o clique num **mundo** muda de verdade — e aí muda
servidor e mundo de uma vez.

Isso exige distinguir dois estados que hoje são um só:

- **servidor ativo** — onde estou de fato (é o que o backend guarda)
- **servidor em exibição** — o que estou olhando (só no cliente)

Enquanto os dois divergem, a lista mostra um aviso discreto de que aquele não é
o servidor em que se está.

### O que o servidor precisa passar a informar

Hoje `GET /presence/counts` devolve `{ mapId: quantidade }` **apenas do servidor
ativo**. Para a barra lateral funcionar são necessárias duas mudanças:

1. **Quem, não só quantos.** A lista precisa de nome, identidade e estado
   (microfone, transmitindo) por mundo. A identidade é o `userId` que o
   `PresenceGateway` já expõe desde a migração do LiveKit.
2. **De qualquer servidor de que sou membro**, não só do ativo — sem trocar nada.
   É isso que permite olhar sem sair.

E a entrega passa a ser por **evento**: quando alguém entra, sai ou troca de
mundo, quem está com aquele servidor em exibição recebe a atualização. O polling
de 8 segundos do `MapSelectPage` sai.

**Cuidado de privacidade:** a lista só pode conter pessoas de servidores de que
quem pede é membro. O gateway já isola salas por servidor; a consulta nova
precisa respeitar o mesmo limite, e isso entra nos testes.

**Cuidado de volume:** com muitos mundos e muita gente, mandar a lista inteira a
cada movimento é desperdício. Manda-se só o delta (entrou, saiu, mudou de estado),
e a lista cheia apenas ao passar a exibir um servidor.

## Parte 2 — Áudio contínuo

Entrar num mundo conecta à conversa automaticamente, sem clique.

**Estado lembrado**, por pessoa e entre sessões: microfone ligado ou desligado, e
som ligado ou desligado. Na primeira vez de todas, o microfone vem **desligado** —
entra-se ouvindo. A partir daí vale sempre o último estado.

Trocar de mundo mantém as preferências: sai da sala anterior, entra na nova, e
microfone e som continuam como estavam. Isso já é meio caminho andado, porque a
troca de sala de mídia foi implementada junto com o LiveKit.

**O estado precisa ficar visível o tempo todo.** Como agora se entra na voz sem
pedir, o rodapé da barra lateral mostra permanentemente se o microfone está
aberto, e é ali que se desliga. Um microfone aberto sem indicação clara é o mesmo
problema de privacidade que já foi corrigido na janela de mídia, e conectar
automaticamente aumenta a chance de alguém não perceber.

**Falha de permissão não pode travar a entrada:** se o navegador negar o
microfone, entra-se no mundo mesmo assim, ouvindo, com aviso discreto. Nunca
bloquear a entrada no mundo por causa de mídia.

---

## Fora de escopo

- **Arte/ícone por servidor** — iniciais do nome bastam por ora.
- **Mensagens diretas e chat por servidor** — o chat continua por mundo.
- **Notificação de atividade** ("tem gente no Ágora") além do que a lista mostra.
- **Reordenar servidores** por arrastar.
- **Prévia do mundo** ao passar o mouse.
- **Estado de áudio sincronizado entre dispositivos** — a preferência fica no
  navegador; abrir noutro computador começa do padrão.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Vazar quem está online para quem não é membro | A consulta filtra por membership no servidor; teste de isolamento explícito, como o que já existe para mundos |
| Tráfego de presença crescer demais | Só deltas; lista cheia apenas ao trocar o servidor exibido |
| Microfone abrindo sozinho sem a pessoa perceber | Estado sempre visível no rodapé; primeira vez sempre mudo |
| Confusão entre servidor exibido e servidor ativo | Aviso na lista enquanto divergirem, e o rodapé sempre mostra onde se está |
| Troca de servidor com voz ativa deixar conexão pendurada | Reusar o caminho de troca de mundo já implementado, que desconecta e reconecta a sala de mídia |

## Como validar

1. **Navegar sem desconectar:** com a voz ativa, clicar noutro servidor; o avatar
   e a chamada continuam onde estavam, e o rodapé mostra isso.
2. **Trocar de verdade:** clicar num mundo de outro servidor troca as duas coisas
   de uma vez, sem passar por tela intermediária, e a voz reconecta na sala nova.
3. **Tempo real:** com duas sessões, uma entra num mundo e a outra vê a pessoa
   aparecer na lista sem recarregar.
4. **Isolamento:** membro de um servidor não vê pessoas de outro de que não faz
   parte, nem pela API chamada direto.
5. **Áudio lembrado:** desligar o microfone, sair, voltar — continua desligado.
   Ligar, sair, voltar — continua ligado. Primeira vez de todas: desligado.
6. **Permissão negada:** com o microfone bloqueado no navegador, ainda é possível
   entrar no mundo e ouvir.
7. **Colapsar:** o estado de cada mundo persiste entre sessões; o mundo atual
   nasce expandido e os vazios colapsados.
