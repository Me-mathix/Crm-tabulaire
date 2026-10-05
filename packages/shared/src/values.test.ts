import { describe, expect, it } from 'vitest';
import { parseValue } from './values';

describe('parseValue', () => {
  it('traite les entrées vides comme une cellule vide, quel que soit le type', () => {
    for (const type of ['text', 'number', 'date', 'phone'] as const) {
      expect(parseValue(type, '')).toEqual({ ok: true, value: null });
      expect(parseValue(type, '   ')).toEqual({ ok: true, value: null });
      expect(parseValue(type, null)).toEqual({ ok: true, value: null });
      expect(parseValue(type, undefined)).toEqual({ ok: true, value: null });
    }
  });

  describe('texte', () => {
    it('retire les espaces en bordure', () => {
      expect(parseValue('text', '  Dupont ')).toEqual({ ok: true, value: 'Dupont' });
    });
    it('refuse un texte trop long', () => {
      expect(parseValue('text', 'a'.repeat(1001)).ok).toBe(false);
    });
    it('refuse un objet', () => {
      expect(parseValue('text', { a: 1 }).ok).toBe(false);
    });
  });

  describe('nombre', () => {
    it('accepte un nombre JSON', () => {
      expect(parseValue('number', 42)).toEqual({ ok: true, value: 42 });
    });
    it('accepte le format français avec virgule et espaces', () => {
      expect(parseValue('number', '1 234,5')).toEqual({ ok: true, value: 1234.5 });
      expect(parseValue('number', '-0,25')).toEqual({ ok: true, value: -0.25 });
    });
    it('refuse le texte, les notations exotiques et les valeurs non finies', () => {
      for (const input of ['12abc', '1e5', '0x10', 'abc', '1,2,3', Infinity, NaN]) {
        expect(parseValue('number', input).ok).toBe(false);
      }
    });
    it('normalise -0 en 0', () => {
      expect(parseValue('number', '-0')).toEqual({ ok: true, value: 0 });
    });
  });

  describe('date', () => {
    it('accepte le format ISO et le format JJ/MM/AAAA', () => {
      expect(parseValue('date', '2026-10-05')).toEqual({ ok: true, value: '2026-10-05' });
      expect(parseValue('date', '5/10/2026')).toEqual({ ok: true, value: '2026-10-05' });
    });
    it('refuse les dates inexistantes', () => {
      expect(parseValue('date', '31/02/2026').ok).toBe(false);
      expect(parseValue('date', '2026-13-01').ok).toBe(false);
    });
    it('gère les années bissextiles', () => {
      expect(parseValue('date', '29/02/2024').ok).toBe(true);
      expect(parseValue('date', '29/02/2025').ok).toBe(false);
    });
    it('refuse un format inconnu', () => {
      expect(parseValue('date', '05-10-2026').ok).toBe(false);
    });
  });

  describe('téléphone', () => {
    it('normalise un numéro français en E.164', () => {
      expect(parseValue('phone', '06 12 34 56 78')).toEqual({ ok: true, value: '+33612345678' });
      expect(parseValue('phone', '+33 6 12 34 56 78')).toEqual({ ok: true, value: '+33612345678' });
    });
    it('refuse un numéro invalide', () => {
      expect(parseValue('phone', '12').ok).toBe(false);
      expect(parseValue('phone', 'abc').ok).toBe(false);
    });
  });
});
