export const FIELD_TYPES = ['text', 'number', 'date', 'phone'] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texte',
  number: 'Nombre',
  date: 'Date',
  phone: 'Téléphone',
};

export function isFieldType(value: unknown): value is FieldType {
  return typeof value === 'string' && (FIELD_TYPES as readonly string[]).includes(value);
}
