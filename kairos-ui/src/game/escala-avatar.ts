// Tamanho padrão do avatar, em fator de escala aplicado direto no sprite.
//
// Mora num módulo próprio porque quem precisa dele são dois lados que não podem
// se importar: o boneco (que arrasta o Pixi junto) e a camada de presença (que
// carrega no boot de qualquer rota). Repetir o número nos dois foi o que fez a
// lista de hairStyle divergir entre front e API.
export const ESCALA_PADRAO = 0.8
