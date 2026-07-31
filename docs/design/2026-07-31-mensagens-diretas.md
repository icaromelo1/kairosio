# Mensagens diretas

> Design aprovado em 31/07/2026 (sessão de brainstorming).
> Conversa privada e persistente entre dois amigos, fora de qualquer servidor.
>
> Terceiro de três specs. **Depende de `2026-07-31-amigos.md`** — sem amizade não
> há com quem conversar — e dos painéis de `2026-07-31-tela-unica.md`.

---

## Por que

O chat que existe hoje é **por mundo e efêmero**: as mensagens somem ao trocar de
mundo e nada é guardado. Serve para conversa de sala, não para falar com alguém.

Mensagem direta é o oposto em todos os eixos: é entre duas pessoas específicas,
independe de onde cada uma está, e **precisa sobreviver** — mensagem que some
quando o outro não estava online não é mensagem, é grito no vazio.

Por isso este spec é separado: não é uma variação do chat, é um subsistema com
armazenamento, histórico, estado de leitura e interface próprios.

---

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Quem pode conversar | **Só amigos aceitos** | Evita mensagem de desconhecido sem construir bloqueio/denúncia agora |
| Persistência | **Guardada no banco**, sem prazo | Mensagem que some não cumpre a função |
| Aviso de nova mensagem | **Marcador na barra lateral** | Escolha do Icaro: não interrompe quem está em conversa por voz |
| Entrega | **Pelo socket que já existe** | O gateway já mantém a conexão e sabe quem está online |
| Onde aparece | **Painel**, no modelo da tela única | Coerente com o resto |

---

## Parte 1 — Dados

Duas tabelas:

**Conversa** — o par de pessoas, com a garantia de que existe **uma só** por par
(guardar os dois ids sempre na mesma ordem e ter índice único sobre eles; sem
isso, dois cliques simultâneos criam duas conversas paralelas e as mensagens se
dividem entre elas).

**Mensagem** — conversa, autor, texto, data de envio.

O estado de leitura fica na conversa, por pessoa: a data da última leitura de
cada lado. Contar não-lidas é comparar essa marca com a data das mensagens — mais
barato e mais simples que uma marca por mensagem.

Limites, seguindo o que o chat de mundo já faz: **teto de caracteres** por
mensagem e **intervalo mínimo** entre envios, ambos validados no servidor, porque
no cliente seriam contornáveis pelo console.

## Parte 2 — Entrega

Pelo socket que já existe. Ao enviar, o servidor grava e entrega a quem está
online; quem está offline recebe ao abrir a conversa, pelo histórico.

**A entrega verifica a amizade a cada mensagem**, não só ao abrir a conversa — se
alguém deixa de ser amigo ou bloqueia no meio, as mensagens seguintes param. Sem
essa checagem, uma conversa aberta viraria um canal permanente que sobrevive ao
fim da amizade.

O histórico é carregado por página, do mais recente para o mais antigo, com
rolagem que busca mais ao chegar no topo — o padrão de qualquer aplicativo de
conversa, e o que evita carregar meses de mensagem de uma vez.

## Parte 3 — Interface

Um painel de conversa, aberto pelo painel de amigos ou pelo marcador de
não-lidas. Lista de conversas à esquerda, mensagens à direita.

O comportamento de rolagem repete o que o chat de mundo já resolveu em 30/07:
**auto-rolagem com trava**. Se você subiu para ler algo, mensagem nova não puxa a
visão de volta; aparece um indicador para voltar ao fim quando quiser.

O marcador de não-lidas vive no ícone de amigos da barra lateral, com o total, e
o nome do amigo destacado na lista. Nada de aviso que aparece e some — foi a
escolha explícita para não interromper quem está em conversa por voz.

---

## Fora de escopo

- **Grupos** (conversa com três ou mais).
- **Anexos**: imagem, arquivo, áudio.
- **Edição e exclusão** de mensagem enviada.
- **Reações** e respostas encadeadas.
- **Indicador de "digitando"**.
- **Confirmação de leitura** visível ao outro (a marca existe no banco para
  contar não-lidas, mas não é exposta a quem enviou).
- **Busca** dentro do histórico.
- **Notificação fora da aba** (navegador ou e-mail).

Cada um desses é aditivo e cabe depois sem retrabalho da base.

## Riscos

| Risco | Mitigação |
|---|---|
| Conversa duplicada para o mesmo par | Ids sempre na mesma ordem e índice único sobre o par |
| Conversa sobrevivendo ao fim da amizade | Amizade verificada a cada mensagem, não só ao abrir |
| Histórico grande travando a abertura | Paginação do mais recente para trás, buscando mais ao rolar |
| Flood de mensagens | Teto de caracteres e intervalo mínimo, validados no servidor |
| Não-lidas divergindo do real | Uma marca de leitura por pessoa na conversa, atualizada ao abrir; a contagem é derivada, nunca guardada em separado |
| Crescimento sem limite da tabela | Aceito por ora: o volume esperado é baixo. Se virar problema, arquivar conversa inativa — registrado, não implementado |

## Como validar

1. **Ida e volta:** A manda, B recebe na hora estando online.
2. **Offline:** B fecha o Kairos, A manda, B abre e a mensagem está lá.
3. **Não-lidas:** o contador aparece na barra lateral, some ao abrir a conversa,
   e não reaparece ao trocar de mundo.
4. **Uma conversa por par:** A e B abrem a conversa ao mesmo tempo — só uma é
   criada, e nenhuma mensagem se perde entre duas.
5. **Fim da amizade:** com a conversa aberta dos dois lados, B remove A; a
   mensagem seguinte de A é recusada.
6. **Não-amigo:** tentar mandar mensagem para quem não é amigo é recusado, mesmo
   chamando o socket direto pelo console.
7. **Limites:** mensagem acima do teto é cortada; duas mensagens em sequência
   rápida demais são recusadas.
8. **Rolagem:** subir no histórico e receber mensagem nova não puxa a visão.
