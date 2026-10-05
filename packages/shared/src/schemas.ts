import { z } from 'zod';
import { FIELD_TYPES } from './fieldTypes';
import { FILTER_OPERATORS, type FilterInput } from './filters';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type SortInput } from './types';

const uuid = z.string().uuid('Identifiant invalide');

const label = z
  .string()
  .trim()
  .min(1, 'Le nom de la colonne est requis')
  .max(100, '100 caractères maximum');

/* ---------- Colonnes ---------- */

export const createFieldSchema = z.object({
  label,
  type: z.enum(FIELD_TYPES),
});
export type CreateFieldInput = z.infer<typeof createFieldSchema>;

export const updateFieldSchema = z
  .object({
    label: label.optional(),
    width: z.number().int().min(60).max(1000).optional(),
  })
  .refine((data) => data.label !== undefined || data.width !== undefined, {
    message: 'Aucune modification fournie',
  });
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;

export const reorderFieldsSchema = z.object({
  ids: z
    .array(uuid)
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Identifiants en double' }),
});
export type ReorderFieldsInput = z.infer<typeof reorderFieldsSchema>;

/* ---------- Contacts ---------- */

const contactValues = z.record(z.string(), z.unknown());

export const createContactSchema = z.object({ values: contactValues.optional() });
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({ values: contactValues });
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const sortInputSchema = z.object({
  fieldId: uuid,
  direction: z.enum(['asc', 'desc']),
});

export const filterInputSchema = z.object({
  fieldId: uuid,
  operator: z.enum(FILTER_OPERATORS),
  value: z.unknown().optional(),
});

/**
 * Paramètres de `GET /contacts` :
 * - `limit`, `offset` : pagination
 * - `sort`            : `<fieldId>:asc` ou `<fieldId>:desc`
 * - `filters`         : tableau JSON de `{ fieldId, operator, value? }`, combinés en ET
 */
export const listContactsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z
    .string()
    .optional()
    .transform((raw, ctx): SortInput | undefined => {
      if (!raw) return undefined;
      const [fieldId, direction] = raw.split(':');
      const parsed = sortInputSchema.safeParse({ fieldId, direction });
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', message: 'Paramètre sort invalide (attendu : <fieldId>:asc|desc)' });
        return z.NEVER;
      }
      return parsed.data;
    }),
  filters: z
    .string()
    .optional()
    .transform((raw, ctx): FilterInput[] => {
      if (!raw) return [];
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Paramètre filters : JSON invalide' });
        return z.NEVER;
      }
      const parsed = z.array(filterInputSchema).max(20).safeParse(json);
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', message: 'Paramètre filters invalide' });
        return z.NEVER;
      }
      return parsed.data;
    }),
});
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

/** Construit la query string de `GET /contacts` (utilisé par le front). */
export function encodeListContactsQuery(query: {
  limit?: number;
  offset?: number;
  sort?: SortInput;
  filters?: FilterInput[];
}): string {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  if (query.sort) params.set('sort', `${query.sort.fieldId}:${query.sort.direction}`);
  if (query.filters && query.filters.length > 0) params.set('filters', JSON.stringify(query.filters));
  return params.toString();
}
