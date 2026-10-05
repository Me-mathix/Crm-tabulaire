import type { FieldType } from './fieldTypes';
import { parseValue, type CellValue } from './values';

export type FieldTypeMap = ReadonlyMap<string, FieldType>;

export type ValuesParseResult =
  | { ok: true; set: Record<string, CellValue>; unset: string[] }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Valide un objet `{ [fieldId]: valeur }` envoyé pour créer ou modifier un contact.
 * - `set`   : valeurs normalisées à écrire
 * - `unset` : colonnes à vider (valeur vide reçue)
 */
export function parseContactValues(
  fieldTypes: FieldTypeMap,
  input: Record<string, unknown>,
): ValuesParseResult {
  const set: Record<string, CellValue> = {};
  const unset: string[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const [fieldId, raw] of Object.entries(input)) {
    const type = fieldTypes.get(fieldId);
    if (!type) {
      fieldErrors[fieldId] = 'Colonne inconnue';
      continue;
    }
    const result = parseValue(type, raw);
    if (!result.ok) fieldErrors[fieldId] = result.error;
    else if (result.value === null) unset.push(fieldId);
    else set[fieldId] = result.value;
  }

  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, set, unset };
}
