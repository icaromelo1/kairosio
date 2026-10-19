const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z0-9_]{1,30}$/;
export const SLOTS = [
  'cabelo',
  'chapeu',
  'rosto',
  'cima',
  'baixo',
  'sapato',
  'acessorio',
] as const;

export interface Aparencia {
  v: 1;
  pele: string;
  corCabelo: string;
  pecas: Record<(typeof SLOTS)[number], { id: string; cor: string }>;
}

export function validarAparencia(bruta: unknown): Aparencia | null {
  if (
    !bruta ||
    typeof bruta !== 'object' ||
    JSON.stringify(bruta).length > 1500
  )
    return null;
  const a = bruta as Record<string, unknown>;
  if (a.v !== 1 || typeof a.pele !== 'string' || !HEX.test(a.pele)) return null;
  if (typeof a.corCabelo !== 'string' || !HEX.test(a.corCabelo)) return null;
  const pecas = a.pecas as Record<string, unknown> | undefined;
  if (!pecas || typeof pecas !== 'object') return null;
  const saida = {} as Aparencia['pecas'];
  for (const slot of SLOTS) {
    const item = pecas[slot] as Record<string, unknown> | undefined;
    if (!item || typeof item.id !== 'string' || !ID.test(item.id)) return null;
    if (typeof item.cor !== 'string' || !HEX.test(item.cor)) return null;
    saida[slot] = { id: item.id, cor: item.cor };
  }
  return { v: 1, pele: a.pele, corCabelo: a.corCabelo, pecas: saida };
}
