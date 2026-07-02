# Plano — convidados não acumulam no banco + sessão única por usuário

> Origem: consulta ao banco mostrou 42 de 49 usuários (86%) sendo convidados
> nunca apagados; e o Icaro percebeu que abrir a mesma conta em várias abas
> gerava um "personagem" duplicado por aba, todos andando de forma
> independente. Status: ✅ **implementado 02/07/2026**.

## 1. Convidado é apagado ao clicar em "Sair"

- `POST /auth/guest` continua criando a conta normalmente (precisa existir
  pra funcionar durante a sessão — personagem, mundo salvo, jukebox etc
  dependem do FK de usuário).
- Novo endpoint `POST /auth/logout` (`auth.controller.ts`): se
  `user.isGuest`, apaga a conta inteira (`AuthService.logout`).
  - `Character` e `WorldState` têm relação `@OneToOne(() => User, { onDelete:
    'CASCADE' })` agora — apagar o `User` já leva o personagem/mundo salvo
    junto, sem precisar apagar cada tabela manualmente.
  - `OrgMembership.userId` é uma coluna solta (nunca teve FK real — ver
    comentário no arquivo), então é limpa manualmente antes de apagar o
    usuário, senão fica pendurada sem dono.
  - `Track.addedBy` e `Feedback.authorId` também são colunas soltas (sem FK):
    ficam como estão — não fazem sentido apagar em cascata (a música
    continua existindo pra sala, o feedback já registrou o e-mail como texto).
- Frontend: `GamePage.vue` `leave()` agora chama `logoutApi()` **antes** de
  limpar o token local (`useAuthStore().logout()`) — precisa do token ainda
  válido pra identificar de quem é a conta a apagar. Conta real (não
  convidado) não sofre nada, é um no-op no backend.
- **Fechar a aba sem clicar em "Sair" não apaga nada** — escopo combinado com
  o Icaro foi só "no momento que deslogar", não uma limpeza agressiva por
  timeout. Os ~42 convidados já acumulados na base de produção **não foram
  apagados** por essa mudança (é código novo, só vale daqui pra frente) — se
  quiser limpar o passivo existente, precisa de uma ação explícita à parte.

## 2. Sessão única por usuário (multi-aba)

Causa raiz: `PresenceGateway` guardava um `Player` por `socket.id`, não por
usuário. Como o JWT fica no `localStorage` (compartilhado entre abas do
mesmo navegador/origem), abrir N abas da mesma conta gera N sockets com o
MESMO `userId`, cada um com seu próprio `Player` — N cópias do personagem
andando de forma independente na sala.

- Novo `Map<string, string>` (`userSocket`): guarda qual `socket.id` é o
  "dono" ativo de cada `userId`.
- Em `handleConnection`: se o `userId` já tem um socket diferente registrado,
  esse socket antigo recebe o evento `sessionKicked` e é desconectado
  (`socket.disconnect(true)`) — o `handleDisconnect` dele roda normalmente
  (limpa o `Player`, avisa a sala com `playerLeft`).
- **Não entra em loop de kick mútuo**: desconexão iniciada pelo *servidor*
  não aciona o auto-reconnect do socket.io no cliente (comportamento padrão
  documentado da lib) — a aba antiga simplesmente fica desconectada até o
  usuário decidir recarregar.
- Frontend: `presence.ts` escuta `sessionKicked` num `ref` global;
  `GamePage.vue` mostra um overlay bloqueante ("Você entrou em outro lugar")
  com botão de recarregar, e também congela o loop de movimento local
  (senão o personagem continuava "andando" visualmente numa aba já
  desconectada da sala).
- Convidados **também** são cobertos (cada guest tem seu próprio `userId`,
  então isso não misturaria contas de convidados diferentes) — só afeta
  quando é literalmente a MESMA conta em duas abas/dispositivos.

## Fora do escopo desta v1

- Nenhuma limpeza retroativa dos ~42 convidados já existentes na produção.
- Sem timeout/expiração automática pra convidado que fecha a aba sem clicar
  em "Sair" (ficou definido como aceitável pelo Icaro).
- Sessão única não distingue "abas do mesmo navegador" de "dispositivos
  diferentes" — qualquer segunda conexão da mesma conta derruba a primeira,
  por design (era exatamente o comportamento pedido).
