import { describe, expect, it } from 'vitest';
import { parseContactValues } from './contactValues';
import type { FieldType } from './fieldTypes';

const fields = new Map<string, FieldType>([
  ['name', 'text'],
  ['score', 'number'],
  ['phone', 'phone'],
]);

describe('parseContactValues', () => {
  it('sépare les valeurs à écrire et les colonnes à vider', () => {
    expect(parseContactValues(fields, { name: ' Ana ', score: '12', phone: '' })).toEqual({
      ok: true,
      set: { name: 'Ana', score: 12 },
      unset: ['phone'],
    });
  });

  it('renvoie une erreur par colonne invalide ou inconnue', () => {
    const result = parseContactValues(fields, { score: 'douze', unknown: 'x', name: 'ok' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(['score', 'unknown']);
    }
  });
});
