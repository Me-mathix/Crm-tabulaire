import { describe, expect, it } from 'vitest';
import { formatValue, toEditableString } from './format';
import { parseValue } from './values';

const NNBSP = ' ';

describe('formatValue', () => {
  it('renvoie une chaîne vide pour une cellule vide', () => {
    expect(formatValue('number', null)).toBe('');
    expect(formatValue('text', undefined)).toBe('');
  });
  it('formate les nombres à la française', () => {
    expect(formatValue('number', 1234.5)).toBe(`1${NNBSP}234,5`);
  });
  it('formate les dates en JJ/MM/AAAA', () => {
    expect(formatValue('date', '2026-10-05')).toBe('05/10/2026');
  });
  it('formate les numéros français au format national', () => {
    expect(formatValue('phone', '+33612345678')).toBe('06 12 34 56 78');
  });
});

describe('toEditableString', () => {
  it('produit un texte que parseValue sait relire (aller-retour)', () => {
    const cases = [
      ['number', 1234.5],
      ['date', '2026-10-05'],
      ['phone', '+33612345678'],
      ['text', 'Élodie'],
    ] as const;
    for (const [type, value] of cases) {
      expect(parseValue(type, toEditableString(type, value))).toEqual({ ok: true, value });
    }
  });
});
