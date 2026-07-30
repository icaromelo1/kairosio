# De organizações a servidores

> Design aprovado em 30/07/2026 (sessão de brainstorming).
> Troca o modelo mental de multi-tenancy corporativo pelo de servidores no estilo
> Discord, conserta o beco sem saída do convidado, torna o convite um link fixo e
> dá gestão de verdade ao painel de administração.
>
> Par deste spec: `2026-07-30-sala-lateral-audio.md`, que constrói a barra lateral
> em duas camadas. **Este vem primeiro** — a barra lateral depende do vocabulário
> e dos endpoints definidos aqui.

---

## Por que

O Kairos nasceu com multi-tenancy pensado como empresa: você pertence a **uma**
organização, tem um papel nela, e trocar exige passar por uma tela de onboarding.
Mas o produto que está sendo construído é social — um espaço onde a pessoa entra
em vários grupos, circula entre eles e sai quando quer. O vocabulário corporativo
briga com isso.

A auditoria feita em 30/07 sobre os dados reais de produção encontrou o seguinte:

| Achado | Evidência |
|---|---|
| **Convidado fica preso** numa tela sem saída | Reproduzido em produção: convidado tem 0 orgs → é mandado ao onboarding → o cartão de criar está escondido para ele → sem código de convite não há como sair |
| Duas organizações **órfãs** | `teste` e `gabs`: zero membros e **dono já apagado** |
| Sete convites, **todos expirados** | Vencimentos entre 29/06 e 09/07; cada clique em "gerar" cria um código novo |
| **Ninguém consegue sair** de uma organização | Não existe endpoint; só o admin remove terceiros |
| **Ninguém consegue apagar** uma organização | Por isso as órfãs continuam lá |
| O **dono pode sumir** | `ownerId` aponta para usuário apagado, sem transferência de posse |
| `listMine` faz **N+1 consultas** | Laço de `findOne` por membership |

O beco sem saída **foi introduzido em 30/07**, no mesmo dia, pela correção que
impediu convidados de criar organização. A correção estava certa quanto ao
problema (era ela que gerava as órfãs), mas não seguiu o fluxo até o fim.

---

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Modelo mental | **Servidor**, no lugar de organização/empresa | O produto é social, não corporativo |
| Vocabulário do mapa | Continua **mundo** | "Canal" descreve mal um mapa pixel art por onde se anda |
| Escopo do renome | **Tudo**: interface, código e banco | O produto é pré-beta, sem usuário real — decisão do Icaro. Coerência total vale mais que preservar dado de teste |
| Convite | **Link fixo** por servidor, sem expirar, com revogar | Os sete códigos mortos são o sintoma; o que se quer é um link que se possa mandar hoje e continuar valendo |
| Apagar servidor | **Arquivar** | Escolha do Icaro: dado recuperável |
| Dados atuais | **Base zerada** | Só há conta de teste; começar o beta limpo evita arrastar resíduo. Os 9 feedbacks foram exportados para `docs/historico/` antes |
| Convidado sem servidor | Vai **direto ao jogo** | Ele já enxerga os mundos abertos; a tela de servidor não deveria aparecer |

---

## Parte 1 — O beco sem saída (prioridade)

Está quebrado em produção agora. Regra nova, no destino pós-login:

- Tem **um** servidor → entra direto no jogo, como hoje.
- Tem **vários** → vai à tela de escolha.
- Tem **nenhum** e **pode criar** (conta real) → tela de escolha, com criar e entrar por convite.
- Tem **nenhum** e **não pode criar** (convidado) → **vai direto ao jogo**, nos mundos abertos.

A tela de servidores deixa de ser um pedágio e passa a ser um destino: dá para
chegar nela por escolha, e ela sempre tem uma saída visível para o jogo.

Verificar também que um convidado que chegue nela por um link de convite
consegue usá-lo — entrar por convite continua permitido para convidado; o que é
bloqueado é **criar**.

## Parte 2 — Renome

Interface, código **e banco** passam a dizer servidor. Entidades, tabelas e
colunas — sem mapeamento histórico, sem nome legado em lugar nenhum.

Alcance: 279 ocorrências em 38 arquivos. Rotas da API passam de `/org` para
`/server`. Como não há consumidor externo além do próprio front — que é
deployado junto — não é preciso manter as rotas antigas.

**A base é zerada junto.** O produto é pré-beta e só tem conta de teste; começar
o beta limpo evita arrastar resíduo de seis meses de experimento. Isso torna o
renome do banco trivial: as tabelas antigas são derrubadas, o `synchronize: true`
recria o schema novo no boot, e o `MapService` re-semeia os três mundos oficiais
sozinho, como já faz.

Antes de zerar, duas salvaguardas:

1. **Backup do banco** (`pg_dump`), guardado fora do repositório. Leva segundos
   na escala atual e é a única volta possível.
2. **Os 9 feedbacks já foram exportados** para `docs/historico/feedback-testadores-2026-06.md`.
   Eram o registro de como os testadores guiaram o produto — proporções dos
   objetos, sentar em cadeira, ghost preview, o problema do microfone — e é a
   única coisa ali que não se reconstrói.

**Regra para não errar:** o renome é mecânico e o risco está em trocar algo por
engano. Nenhuma mudança de comportamento entra no mesmo commit do renome; quem
revisar precisa poder ler o diff como "só troquei nomes".

## Parte 3 — Convite como link fixo

Cada servidor tem **um** código permanente, criado junto com ele, sem expiração e
sem limite de usos. O painel mostra o link pronto para copiar — não há botão de
gerar.

**Revogar** troca o código por outro, invalidando o anterior. É a saída para
vazamento, e o único caminho pelo qual um link deixa de funcionar.

Os sete códigos antigos **já estão expirados** — venceram entre 29/06 e 09/07 —
então não há link em mãos de ninguém que ainda funcione, e não existe risco de
quebrar algo em uso. Eles são apagados junto com a limpeza da Parte 4, e cada
servidor existente ganha seu link fixo na mesma passada. O campo de expiração
deixa de ser preenchido: um convite só morre quando alguém o revoga.

## Parte 4 — Sair, arquivar e posse

**Sair:** qualquer membro sai quando quiser. Exceção: o **último administrador**
não sai antes de passar a posse — senão o servidor fica sem ninguém que possa
administrá-lo. A mensagem de erro diz exatamente isso e aponta o caminho.

**Transferir posse:** o dono escolhe outro membro, que vira administrador; quem
transferiu continua no servidor como membro comum.

**Arquivar:** o servidor some de todas as listagens, seletores e da barra
lateral, mas os dados permanecem. Para o arquivamento não virar a mesma sujeira
com outro nome, o painel tem uma seção de arquivados com opção de **restaurar** —
o que estiver lá está lá por decisão de alguém, e é visível.

**As órfãs e os convites vencidos** deixam de ser um problema a resolver: a base
começa zerada (Parte 2), então nascem apenas servidores criados pelo fluxo novo,
já com o bloqueio a convidados que impede a órfã de aparecer.

## Parte 5 — Painel do servidor

O `/admin` de hoje faz o mínimo. Passa a ter:

- **Membros** com data de entrada (a coluna `joinedAt` já existe e não é exibida),
  papel, e as ações de promover, rebaixar e remover.
- **Transferir posse**, com confirmação.
- **Renomear** o servidor.
- **Link de convite** sempre visível, com copiar e revogar.
- **Sair do servidor**.
- **Arquivar**, com confirmação por digitação do nome.
- Seção de **arquivados**, com restaurar.

## Parte 6 — Correções de fluxo

- `listMine` deixa de fazer N+1: uma consulta com join no lugar do laço.
- Rota do convite (`/join/<code>`) continua funcionando e passa a aceitar
  convidado, encaminhando para login/registro quando fizer sentido.
- Servidor recém-criado já nasce com o criador como administrador e com o código
  de convite pronto — hoje o código só existe depois de alguém clicar em gerar.

---

## Endpoints

Renomeados de `/org` para `/server`, mais os novos:

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/server` | cria (bloqueado para convidado) |
| `GET` | `/server/me` | servidor ativo + membros |
| `GET` | `/server/mine` | todos os servidores de que sou membro |
| `POST` | `/server/switch/:id` | troca o ativo |
| `POST` | `/server/join` | entra por código |
| `GET` | `/server/:id/invite` | link fixo (admin) |
| `POST` | `/server/:id/invite/revoke` | **novo** — troca o código (admin) |
| `POST` | `/server/:id/leave` | **novo** — sair |
| `POST` | `/server/:id/transfer` | **novo** — passar posse (dono) |
| `POST` | `/server/:id/archive` | **novo** — arquivar (dono) |
| `POST` | `/server/:id/restore` | **novo** — restaurar (dono) |
| `PUT` | `/server` | renomear (admin) |
| `PUT` | `/server/member/:id/role` | papel (admin) |
| `DELETE` | `/server/member/:id` | remover membro (admin) |

Toda rota nova valida que quem chama é membro — e, quando a ação exige,
administrador ou dono. O padrão de autorização é o `OrgAdminGuard` que já existe,
renomeado junto.

---

## Fora de escopo

- **Servidores públicos / descoberta.** Entrar continua sendo só por link.
- **Papéis além de admin e membro.** Nada de permissões granulares por enquanto.
- **Ícone/avatar de servidor.** A barra lateral vai usar as iniciais do nome; arte
  por servidor fica para depois.
- **Vários servidores ativos ao mesmo tempo.** Continua um ativo por vez; o que
  muda é a facilidade de trocar.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Renome mecânico quebrar algo por engano | Renome sem mudança de comportamento no mesmo commit; typecheck dos dois lados e teste do fluxo completo antes do merge |
| Zerar a base sem volta | `pg_dump` antes de qualquer comando, guardado fora do repositório; feedbacks já exportados para `docs/historico/` |
| Arquivar virar acúmulo invisível | Seção de arquivados visível no painel, com restaurar |
| Schema novo não subir sozinho | Validar em banco descartável local antes de tocar no servidor: derrubar schema, subir a API e conferir que as tabelas e os três mundos oficiais nascem |
| Convidado entrar por convite e criar sujeira nova | Convidado entra, mas não cria; ao sair, a conta é apagada e a membership junto (comportamento que já existe) |

## Como validar

1. **O beco sem saída:** convidado novo entra e chega ao jogo sem passar por tela
   de servidor. É o teste que representa a regressão de hoje.
2. **Convite:** link copiado do painel funciona depois de uma semana (hoje
   morreria); revogar invalida o anterior e o novo funciona.
3. **Sair:** membro comum sai; último administrador é impedido com mensagem que
   explica; depois de transferir a posse, consegue sair.
4. **Arquivar:** servidor arquivado some da barra lateral, do seletor e de
   `/server/mine`; restaurar traz de volta com membros e mundos intactos.
5. **Isolamento:** membro de um servidor não enxerga mundos, membros nem convite
   de outro — repetir os testes de isolamento que já passaram no review de 30/07.
6. **Base zerada:** após o deploy, criar conta, servidor e mundo do zero e
   percorrer o fluxo inteiro — é o caminho que todo mundo do beta vai fazer, e
   nunca foi exercitado numa base limpa.
