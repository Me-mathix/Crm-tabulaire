import { describe, expect, it } from 'vitest';
import { DEFAULT_FIELDS, generateContacts } from './fake-data';

describe('generateContacts', () => {
  it('génère le nombre demandé, de façon reproductible', () => {
    const today = new Date('2026-10-05T12:00:00Z');
    const first = generateContacts(500, 1, today);
    expect(first).toHaveLength(500);
    expect(generateContacts(500, 1, today)).toEqual(first);
  });

  it('donne toujours un nom et laisse quelques cellules vides', () => {
    const contacts = generateContacts(500);
    expect(contacts.every((c) => typeof c.name === 'string' && c.name.length > 0)).toBe(true);
    expect(contacts.some((c) => c.phone === undefined)).toBe(true);
    expect(contacts.some((c) => c.score === undefined)).toBe(true);
  });

  it('couvre les quatre types de colonnes', () => {
    expect(new Set(DEFAULT_FIELDS.map((f) => f.type))).toEqual(new Set(['text', 'number', 'date', 'phone']));
  });
});
