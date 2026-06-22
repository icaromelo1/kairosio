# Plano — Status + data de resolução do feedback

> Origem: Icaro — "sempre atualizar o feedback com status e o dia que foi feito ou declinado",
> mostrando um **timer regressivo** ("atualizado há X minutos/dias/meses/anos") **e** a data
> absoluta de quando foi **implementado/declinado** (`dd/mm/yy hh:mm`).
> Status: planejado (parte vira processo, parte vira código). Base: tabela `feedbacks` já tem
> `status` e `updatedAt`.

---

## 1. Processo (regra permanente)
- **Sempre que um feedback for implementado** → status `resolvido`.
- **Sempre que for recusado** → status `recusado`.
- Em andamento → `em_andamento`. Registrar a data da mudança.
> (Anotado também na memória do agente: sempre atualizar o status ao concluir/recusar.)

## 2. Dado
- Adicionar coluna **`resolvedAt`** (timestamp nullable) em `Feedback`: setada quando o status
  vai pra `resolvido` ou `recusado` (no `updateStatus` do service).
- `updatedAt` já existe (muda a cada alteração).

## 3. UI (FeedbackPage)
Em cada card, além do badge de status, mostrar:
- **Relativo** (timer regressivo): "atualizado há X" — usar `Intl.RelativeTimeFormat('pt-BR')`
  ou helper próprio (segundos→min→horas→dias→meses→anos), calculado sobre `updatedAt`/`resolvedAt`.
- **Absoluto**: quando `resolvido`/`recusado`, "implementado em `dd/mm/yy hh:mm`" ou
  "recusado em `dd/mm/yy hh:mm`" (de `resolvedAt`).
- Atualizar o relativo periodicamente (setInterval ~60s) pra o "há X" ficar vivo.

## 4. Tarefas
1. Coluna `resolvedAt` + setá-la no `updateStatus` (backend). — *quick-win*
2. Helper de tempo relativo (pt-BR) no front. — *quick-win*
3. Exibir relativo + absoluto no card do FeedbackPage; tick periódico. — *médio*
4. (já existe) endpoint admin `PUT /feedback/:id/status` — garantir que seta `resolvedAt`.

## 5. Critérios de aceite
- Card resolvido/recusado mostra "há X" (vivo) e a data absoluta `dd/mm/yy hh:mm`.
- Ao mudar o status, a data de resolução é gravada.
