import type { FieldType, FilterOperator, NormalizedFilter, SortDirection } from '@crm/shared';

/**
 * Traduit le tri et les filtres (déjà validés) en SQL paramétré sur la colonne JSONB `data`.
 * Les identifiants de colonnes et les valeurs passent toujours en paramètres ($n).
 */

export interface ListQueryOptions {
  sort?: { fieldId: string; type: FieldType; direction: SortDirection };
  filters: NormalizedFilter[];
  limit: number;
  offset: number;
}

export interface BuiltQuery {
  text: string;
  values: unknown[];
}

class Params {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const COMPARATORS: Partial<Record<FilterOperator, string>> = {
  eq: '=',
  neq: '<>',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
};

/** Valeur brute de la cellule, en texte (NULL si la cellule est vide). */
function rawValue(key: string): string {
  return `(c.data ->> ${key}::text)`;
}

function sqlCast(type: FieldType): string | null {
  if (type === 'number') return 'numeric';
  if (type === 'date') return 'date';
  return null;
}

/** Valeur typée, pour comparer des nombres et des dates correctement. */
function typedValue(type: FieldType, key: string): string {
  const cast = sqlCast(type);
  return cast ? `${rawValue(key)}::${cast}` : rawValue(key);
}

function sortExpression(type: FieldType, key: string): string {
  // Texte : ordre alphabétique insensible à la casse et aux accents (collation ICU)
  if (type === 'text') return `lower(${rawValue(key)}) COLLATE "und-x-icu"`;
  return typedValue(type, key);
}

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function filterCondition(filter: NormalizedFilter, params: Params): string {
  const { type, operator, values } = filter;
  const key = params.add(filter.fieldId);
  const hasValue = `(c.data ? ${key}::text)`;

  switch (operator) {
    case 'is_empty':
      return `NOT ${hasValue}`;
    case 'is_not_empty':
      return hasValue;
    case 'contains': {
      const pattern = params.add(`%${escapeLike(String(values[0]))}%`);
      if (type === 'phone') {
        return `regexp_replace(${rawValue(key)}, '\\D', '', 'g') LIKE ${pattern}`;
      }
      return `${rawValue(key)} ILIKE ${pattern}`;
    }
    case 'between': {
      const cast = sqlCast(type) ?? 'text';
      const from = params.add(values[0]);
      const to = params.add(values[1]);
      return `${typedValue(type, key)} BETWEEN ${from}::${cast} AND ${to}::${cast}`;
    }
    default: {
      const comparator = COMPARATORS[operator];
      if (!comparator) throw new Error(`Opérateur non géré : ${operator}`);
      const value = params.add(values[0]);
      const cast = sqlCast(type);
      const condition = cast
        ? `${typedValue(type, key)} ${comparator} ${value}::${cast}`
        : `lower(${rawValue(key)}) ${comparator} lower(${value}::text)`;
      // « n'est pas égal à » inclut les cellules vides
      return operator === 'neq' ? `(NOT ${hasValue} OR ${condition})` : condition;
    }
  }
}

export function buildListQuery(options: ListQueryOptions): { list: BuiltQuery; count: BuiltQuery } {
  const params = new Params();
  const conditions = options.filters.map((filter) => filterCondition(filter, params));
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countValues = [...params.values];

  const order: string[] = [];
  if (options.sort) {
    const key = params.add(options.sort.fieldId);
    const direction = options.sort.direction === 'desc' ? 'DESC' : 'ASC';
    // Les cellules vides restent en bas, quel que soit le sens du tri
    order.push(`${sortExpression(options.sort.type, key)} ${direction} NULLS LAST`);
  }
  // Ordre stable (indispensable pour paginer par offset)
  order.push('c.created_at DESC', 'c.id DESC');

  const limit = params.add(options.limit);
  const offset = params.add(options.offset);

  return {
    list: {
      text:
        `SELECT c.id, c.data, c.created_at, c.updated_at FROM contacts c ${where} ` +
        `ORDER BY ${order.join(', ')} LIMIT ${limit} OFFSET ${offset}`,
      values: params.values,
    },
    count: {
      text: `SELECT count(*)::int AS total FROM contacts c ${where}`,
      values: countValues,
    },
  };
}
