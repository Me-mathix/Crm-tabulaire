import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { FieldType } from './fieldTypes';
import { DEFAULT_PHONE_COUNTRY, ISO_DATE_PATTERN, type CellValue } from './values';

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 });

/** Texte affiché dans une cellule en lecture. */
export function formatValue(type: FieldType, value: CellValue | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  switch (type) {
    case 'number':
      return typeof value === 'number' ? numberFormatter.format(value) : String(value);
    case 'date':
      return formatIsoDate(String(value));
    case 'phone':
      return formatPhone(String(value));
    case 'text':
      return String(value);
  }
}

/** Texte proposé dans l'éditeur, que `parseValue` sait relire. */
export function toEditableString(type: FieldType, value: CellValue | null | undefined): string {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'number':
      return String(value).replace('.', ',');
    case 'date':
      return formatIsoDate(String(value));
    case 'phone':
      return formatPhone(String(value));
    case 'text':
      return String(value);
  }
}

export function formatIsoDate(iso: string): string {
  const match = ISO_DATE_PATTERN.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

export function formatPhone(e164: string): string {
  const phone = parsePhoneNumberFromString(e164);
  if (!phone) return e164;
  return phone.country === DEFAULT_PHONE_COUNTRY ? phone.formatNational() : phone.formatInternational();
}
