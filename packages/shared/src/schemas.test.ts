import { describe, expect, it } from 'vitest';
import { encodeListContactsQuery, listContactsQuerySchema, updateFieldSchema } from './schemas';

const fieldId = '8f14e45f-ceea-4e7a-9b1f-2a1d3c4b5e6f';

function parseQuery(qs: string) {
  return listContactsQuerySchema.safeParse(Object.fromEntries(new URLSearchParams(qs)));
}

describe('listContactsQuerySchema', () => {
  it('applique les valeurs par défaut', () => {
    const result = parseQuery('');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ limit: 50, offset: 0, sort: undefined, filters: [] });
    }
  });

  it('relit ce que encodeListContactsQuery produit', () => {
    const qs = encodeListContactsQuery({
      limit: 50,
      offset: 100,
      sort: { fieldId, direction: 'desc' },
      filters: [{ fieldId, operator: 'between', value: [10, 20] }],
    });
    const result = parseQuery(qs);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        limit: 50,
        offset: 100,
        sort: { fieldId, direction: 'desc' },
        filters: [{ fieldId, operator: 'between', value: [10, 20] }],
      });
    }
  });

  it('refuse un tri, des filtres ou une pagination invalides', () => {
    expect(parseQuery('sort=abc').success).toBe(false);
    expect(parseQuery(`sort=${fieldId}:up`).success).toBe(false);
    expect(parseQuery('filters=not-json').success).toBe(false);
    expect(parseQuery('filters=[{"fieldId":"x","operator":"eq"}]').success).toBe(false);
    expect(parseQuery('limit=500').success).toBe(false);
    expect(parseQuery('offset=-1').success).toBe(false);
  });
});

describe('updateFieldSchema', () => {
  it('exige au moins une modification', () => {
    expect(updateFieldSchema.safeParse({}).success).toBe(false);
    expect(updateFieldSchema.safeParse({ label: '  Société ' }).success).toBe(true);
  });
});
