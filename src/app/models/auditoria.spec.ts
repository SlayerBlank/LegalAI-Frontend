import { normalizePage } from './auditoria';

describe('normalizePage', () => {
  it('lee el formato directo de Page (totalElements en la raíz)', () => {
    expect(
      normalizePage({ content: [1, 2], number: 1, size: 2, totalElements: 5, totalPages: 3 }),
    ).toEqual({ content: [1, 2], number: 1, size: 2, totalElements: 5, totalPages: 3 });
  });

  it('lee el formato VIA_DTO ({ content, page })', () => {
    expect(
      normalizePage({
        content: [1],
        page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
      }),
    ).toEqual({ content: [1], number: 0, size: 20, totalElements: 1, totalPages: 1 });
  });

  it('tolera una respuesta vacía o nula', () => {
    expect(normalizePage(null)).toEqual({
      content: [],
      number: 0,
      size: 0,
      totalElements: 0,
      totalPages: 0,
    });
  });
});
