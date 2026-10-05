import type { FieldType } from './fieldTypes';
import { parseValue } from './values';

export const FILTER_OPERATORS = [
  'contains',
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'between',
  'is_empty',
  'is_not_empty',
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/** Nombre de valeurs attendues par l'opérateur. */
export const OPERATOR_ARITY: Record<FilterOperator, 0 | 1 | 2> = {
  contains: 1,
  eq: 1,
  neq: 1,
  lt: 1,
  lte: 1,
  gt: 1,
  gte: 1,
  between: 2,
  is_empty: 0,
  is_not_empty: 0,
};

export const OPERATORS_BY_TYPE: Record<FieldType, readonly FilterOperator[]> = {
  text: ['contains', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  number: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'is_empty', 'is_not_empty'],
  date: ['eq', 'lt', 'gt', 'between', 'is_empty', 'is_not_empty'],
  phone: ['contains', 'is_empty', 'is_not_empty'],
};

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: 'contient',
  eq: 'est égal à',
  neq: "n'est pas égal à",
  lt: 'inférieur à',
  lte: 'inférieur ou égal à',
  gt: 'supérieur à',
  gte: 'supérieur ou égal à',
  between: 'entre',
  is_empty: 'est vide',
  is_not_empty: "n'est pas vide",
};

const DATE_OPERATOR_LABELS: Partial<Record<FilterOperator, string>> = {
  eq: 'le',
  lt: 'avant le',
  gt: 'après le',
  between: 'entre le',
};

export function operatorLabel(type: FieldType, operator: FilterOperator): string {
  return (type === 'date' && DATE_OPERATOR_LABELS[operator]) || OPERATOR_LABELS[operator];
}

export function isOperatorAllowed(type: FieldType, operator: FilterOperator): boolean {
  return OPERATORS_BY_TYPE[type].includes(operator);
}

/** Filtre tel qu'envoyé par le front. `value` est un tableau de 2 éléments pour `between`. */
export interface FilterInput {
  fieldId: string;
  operator: FilterOperator;
  value?: unknown;
}

export type FilterValue = string | number;

/** Filtre validé, prêt à être traduit en SQL. */
export interface NormalizedFilter {
  fieldId: string;
  type: FieldType;
  operator: FilterOperator;
  values: FilterValue[];
}

export type FilterParseResult = { ok: true; filter: NormalizedFilter } | { ok: false; error: string };

type Operand = { ok: true; value: FilterValue } | { ok: false; error: string };

export function normalizeFilter(type: FieldType, input: FilterInput): FilterParseResult {
  const { fieldId, operator } = input;
  if (!isOperatorAllowed(type, operator)) {
    return { ok: false, error: `Opérateur « ${operator} » non disponible pour ce type de colonne` };
  }

  const build = (values: FilterValue[]): FilterParseResult => ({
    ok: true,
    filter: { fieldId, type, operator, values },
  });

  const arity = OPERATOR_ARITY[operator];
  if (arity === 0) return build([]);

  if (operator === 'contains') {
    const term = containsTerm(type, input.value);
    return term === null ? { ok: false, error: 'Valeur de recherche manquante' } : build([term]);
  }

  if (arity === 1) {
    const operand = parseOperand(type, input.value);
    return operand.ok ? build([operand.value]) : operand;
  }

  if (!Array.isArray(input.value) || input.value.length !== 2) {
    return { ok: false, error: 'Deux valeurs attendues' };
  }
  const from = parseOperand(type, input.value[0]);
  if (!from.ok) return from;
  const to = parseOperand(type, input.value[1]);
  if (!to.ok) return to;
  // Nombres et dates ISO se comparent correctement avec <
  return from.value <= to.value ? build([from.value, to.value]) : build([to.value, from.value]);
}

function parseOperand(type: FieldType, raw: unknown): Operand {
  const result = parseValue(type, raw);
  if (!result.ok) return result;
  if (result.value === null) return { ok: false, error: 'Valeur de filtre manquante' };
  return { ok: true, value: result.value };
}

/**
 * Terme de recherche pour « contient ».
 * Pour un téléphone, on compare uniquement les chiffres : « 06 12 » devient « 612 »
 * (le 0 national est retiré) et correspond à `+33612…`.
 */
function containsTerm(type: FieldType, raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (type !== 'phone') return text;
  let digits = text.replace(/\D/g, '');
  if (digits.length > 1 && digits.startsWith('0')) digits = digits.slice(1);
  return digits || null;
}
