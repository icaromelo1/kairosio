# Plano — Interações por tipo de objeto

> Origem: feedback "vamos mapear e entender as interações com cada tipo de objeto" —
> sentar em cadeira/sofá/poltrona, água com efeito (ou bloqueio) ao andar por cima, etc.
> Status: planejado (épico). Base: objetos já têm `kind` + `solid`; avatar tem poses.

---

## 1. Conceito

Cada `kind` de objeto pode ter um **comportamento de interação** quando o avatar entra/
fica em cima/aperta E perto dele. Tipos de comportamento:

| comportamento | objetos | efeito |
|---|---|---|
| **sentar** | `chair`, `sofa`, `poltrona`, `bench` | avatar troca pra pose "sentado", ancorado na posição do objeto; sai ao mover |
| **água** | `water` | ao andar por cima: ou **bloqueia** (já dá com `solid`) ou efeito visual (ondulação/“splash”, talvez reduz velocidade) |
| **abrir** (já existe) | `desk`, `board`, `jukebox`, `servers`, `shelf` | modal/estação (hoje genérico) |
| **decoração** | resto | nenhum |

---

## 2. O que precisa

### Schema
- `MapObject` ganha (opcional) `sit?: boolean` (ou derivar do `kind`). Recomendado: derivar
  por `kind` num mapa `INTERACTIONS[kind] = 'sit' | 'water' | 'open' | none` — sem mexer no dado.
- Novos kinds: `chair`, `sofa`, `poltrona` (+ render no `scene.ts` `drawDetail`).

### Avatar
- Nova pose **`sit`** no `AvatarPuppet` (pernas dobradas / sentado). Sincronizar na rede
  (pose já é sincronizada — só adicionar 'sit' ao tipo Pose no gateway/front).

### Movimento / lógica (GamePage)
- **Sentar**: ao apertar E perto de um objeto "sentável" → pose `sit`, trava posição na
  cadeira (snap), vira pro lado certo; qualquer tecla de movimento → levanta (volta idle).
- **Água**: se `water` não for `solid`, ao pisar aplica efeito (ex: tint/splash + slow).
  Decisão: água é sólida (bloqueia) por padrão? Ou atravessável com efeito? — **confirmar.**

### Editor
- Adicionar os objetos sentáveis na paleta; o comportamento vem do `kind` (sem config extra).

---

## 3. Tarefas
1. Mapa `INTERACTIONS[kind]` (front, compartilhado scene/game).
2. Pose `sit` no avatar + tipo Pose ('sit') no gateway + front.
3. Sentar no GamePage (E perto de sentável → sit + snap; mover → levanta).
4. Novos kinds chair/sofa/poltrona + render + paleta do editor.
5. Efeito de água (definir bloquear vs atravessar com efeito).

## 4. Critérios de aceite
- Apertar E perto de uma cadeira senta o avatar (e os outros veem ele sentado).
- Mover levanta.
- Água tem comportamento definido e consistente.

## 5. A confirmar
- Água: bloqueia ou atravessa com efeito?
- Sentar: por tecla E (interação) ou automático ao pisar na cadeira?
