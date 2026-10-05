import { describe, expect, it } from 'vitest';
import { normalizeFilter } from './filters';

const fieldId = '8f14e45f-ceea-4e7a-9b1f-2a1d3c4b5e6f';

describe('normalizeFilter', () => {
  it("refuse un opérateur non disponible pour le type", () => {
    expect(normalizeFilter('phone', { fieldId, operator: 'gt', value: '06' }).ok).toBe(false);
    expect(normalizeFilter('text', { fieldId, operator: 'between', value: ['a', 'b'] }).ok).toBe(false);
  });

  it("n'attend aucune valeur pour est vide / n'est pas vide", () => {
    expect(normalizeFilter('date', { fieldId, operator: 'is_empty' })).toEqual({
      ok: true,
      filter: { fieldId, type: 'date', operator: 'is_empty', values: [] },
    });
  });

  it('valide et normalise la valeur selon le type de la colonne', () => {
    expect(normalizeFilter('number', { fieldId, operator: 'gt', value: '1 000,5' })).toEqual({
      ok: true,
      filter: { fieldId, type: 'number', operator: 'gt', values: [1000.5] },
    });
    expect(normalizeFilter('date', { fieldId, operator: 'lt', value: '01/02/2026' })).toEqual({
      ok: true,
      filter: { fieldId, type: 'date', operator: 'lt', values: ['2026-02-01'] },
    });
    expect(normalizeFilter('number', { fieldId, operator: 'eq', value: 'abc' }).ok).toBe(false);
  });

  it('exige deux valeurs pour « entre » et les remet dans l’ordre', () => {
    expect(normalizeFilter('number', { fieldId, operator: 'between', value: [80, 20] })).toEqual({
      ok: true,
      filter: { fieldId, type: 'number', operator: 'between', values: [20, 80] },
    });
    expect(normalizeFilter('number', { fieldId, operator: 'between', value: 10 }).ok).toBe(false);
  });

  it('cherche un téléphone sur les chiffres, sans le 0 national', () => {
    expect(normalizeFilter('phone', { fieldId, operator: 'contains', value: '06 12' })).toEqual({
      ok: true,
      filter: { fieldId, type: 'phone', operator: 'contains', values: ['612'] },
    });
    expect(normalizeFilter('phone', { fieldId, operator: 'contains', value: 'abc' }).ok).toBe(false);
  });

  it('refuse une recherche vide', () => {
    expect(normalizeFilter('text', { fieldId, operator: 'contains', value: '  ' }).ok).toBe(false);
  });
});
