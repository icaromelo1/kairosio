import { validarAparencia } from './aparencia';

const valida = {
  v: 1,
  pele: '#e8b894',
  corCabelo: '#3d2817',
  pecas: {
    cabelo: { id: 'curto', cor: '#3d2817' },
    chapeu: { id: 'nenhum', cor: '#c0392b' },
    rosto: { id: 'oculos_sol', cor: '#26262b' },
    cima: { id: 'camiseta', cor: '#2c7441' },
    baixo: { id: 'calca', cor: '#2f3d5c' },
    sapato: { id: 'tenis', cor: '#f0eee8' },
    acessorio: { id: 'nenhum', cor: '#d9a441' },
  },
};

describe('validarAparencia', () => {
  it('aceita uma aparência completa', () => {
    expect(validarAparencia(valida)).toEqual(valida);
  });

  it('descarta campos desconhecidos', () => {
    const resultado = validarAparencia({
      ...valida,
      extra: 'x',
      pecas: { ...valida.pecas, asas: { id: 'a', cor: '#000000' } },
    });
    expect(resultado).not.toHaveProperty('extra');
    expect(resultado?.pecas).not.toHaveProperty('asas');
  });

  it('aceita segunda cor e recusa segunda cor fora do formato', () => {
    const comDetalhe = {
      ...valida,
      pecas: { ...valida.pecas, sapato: { id: 'tenis', cor: '#f0eee8', cor2: '#c0392b' } },
    };
    expect(validarAparencia(comDetalhe)).toEqual(comDetalhe);
    expect(
      validarAparencia({
        ...valida,
        pecas: { ...valida.pecas, sapato: { id: 'tenis', cor: '#f0eee8', cor2: 'red' } },
      }),
    ).toBeNull();
  });

  it('recusa cor fora do formato e id com caminho', () => {
    expect(validarAparencia({ ...valida, pele: 'red' })).toBeNull();
    expect(
      validarAparencia({
        ...valida,
        pecas: { ...valida.pecas, cima: { id: '../x', cor: '#000000' } },
      }),
    ).toBeNull();
  });

  it('recusa slot faltando', () => {
    const { sapato: _, ...semSapato } = valida.pecas;
    expect(validarAparencia({ ...valida, pecas: semSapato })).toBeNull();
  });
});
