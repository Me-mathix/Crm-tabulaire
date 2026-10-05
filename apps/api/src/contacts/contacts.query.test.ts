import { describe, expect, it } from 'vitest';
import { buildListQuery, escapeLike } from './contacts.query';

const name = '11111111-1111-4111-8111-111111111111';
const score = '22222222-2222-4222-8222-222222222222';

describe('buildListQuery', () => {
  it('trie par défaut du plus récent au plus ancien, avec un ordre stable', () => {
    const { list, count } = buildListQuery({ filters: [], limit: 50, offset: 100 });
    expect(list.text).toContain('ORDER BY c.created_at DESC, c.id DESC LIMIT $1 OFFSET $2');
    expect(list.values).toEqual([50, 100]);
    expect(count.text).not.toContain('WHERE');
    expect(count.values).toEqual([]);
  });

  it('met les cellules vides en bas et départage par date de création', () => {
    const { list } = buildListQuery({
      sort: { fieldId: score, type: 'number', direction: 'desc' },
      filters: [],
      limit: 50,
      offset: 0,
    });
    expect(list.text).toContain(
      'ORDER BY (c.data ->> $1::text)::numeric DESC NULLS LAST, c.created_at DESC, c.id DESC',
    );
    expect(list.values).toEqual([score, 50, 0]);
  });

  it('paramètre toutes les valeurs et partage la clause WHERE avec le comptage', () => {
    const { list, count } = buildListQuery({
      filters: [
        { fieldId: name, type: 'text', operator: 'contains', values: ["d'Ar"] },
        { fieldId: score, type: 'number', operator: 'between', values: [10, 20] },
      ],
      limit: 50,
      offset: 0,
    });
    expect(count.values).toEqual([name, "%d'Ar%", score, 10, 20]);
    expect(list.values).toEqual([...count.values, 50, 0]);
    expect(list.text).not.toContain("d'Ar");
    const where = count.text.slice(count.text.indexOf('WHERE'));
    expect(list.text).toContain(where);
  });

  it('inclut les cellules vides pour « n’est pas égal à »', () => {
    const { count } = buildListQuery({
      filters: [{ fieldId: name, type: 'text', operator: 'neq', values: ['Ana'] }],
      limit: 50,
      offset: 0,
    });
    expect(count.text).toContain('(NOT (c.data ? $1::text) OR lower(');
  });
});

describe('escapeLike', () => {
  it('échappe les jokers LIKE', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});
