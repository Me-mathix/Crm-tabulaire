import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import type { FieldType } from './fieldTypes';

/**
 * Valeur stockée en base (JSONB) pour une cellule :
 * - texte     : chaîne non vide, sans espaces en bordure
 * - nombre    : nombre JSON fini
 * - date      : chaîne ISO `YYYY-MM-DD` (date calendaire, sans fuseau)
 * - téléphone : chaîne E.164 (`+33612345678`)
 * Une cellule vide n'est jamais stockée : la clé est absente de l'objet.
 */
export type CellValue = string | number;

export type ParseResult = { ok: true; value: CellValue | null } | { ok: false; error: string };

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'FR';
export const MAX_TEXT_LENGTH = 1000;
const MAX_ABS_NUMBER = 1e15;

export const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FR_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)$/;

const ok = (value: CellValue | null): ParseResult => ({ ok: true, value });
const fail = (error: string): ParseResult => ({ ok: false, error });

function isBlank(input: unknown): boolean {
  return (
    input === null || input === undefined || (typeof input === 'string' && input.trim() === '')
  );
}

/**
 * Valide et normalise une valeur saisie (chaîne issue d'un éditeur) ou reçue
 * par l'API (valeur JSON). Une entrée vide donne `null` : la cellule est vidée.
 */
export function parseValue(type: FieldType, input: unknown): ParseResult {
  if (isBlank(input)) return ok(null);
  switch (type) {
    case 'text':
      return parseText(input);
    case 'number':
      return parseNumber(input);
    case 'date':
      return parseDate(input);
    case 'phone':
      return parsePhone(input);
  }
}

function parseText(input: unknown): ParseResult {
  if (typeof input !== 'string' && typeof input !== 'number') return fail('Texte attendu');
  const value = String(input).trim();
  if (value.length > MAX_TEXT_LENGTH) return fail(`${MAX_TEXT_LENGTH} caractères maximum`);
  return ok(value);
}

function parseNumber(input: unknown): ParseResult {
  let value: number;
  if (typeof input === 'number') {
    value = input;
  } else if (typeof input === 'string') {
    // Accepte « 1 234,5 » (format français) comme « 1234.5 »
    const cleaned = input.replace(/[\s  ]/g, '').replace(',', '.');
    if (!NUMBER_PATTERN.test(cleaned)) return fail('Nombre invalide');
    value = Number(cleaned);
  } else {
    return fail('Nombre invalide');
  }
  if (!Number.isFinite(value)) return fail('Nombre invalide');
  if (Math.abs(value) >= MAX_ABS_NUMBER) return fail('Nombre trop grand');
  return ok(value === 0 ? 0 : value); // évite de stocker -0
}

function parseDate(input: unknown): ParseResult {
  if (typeof input !== 'string') return fail('Date invalide');
  const text = input.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = ISO_DATE_PATTERN.exec(text);
  const fr = FR_DATE_PATTERN.exec(text);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (fr) {
    [day, month, year] = [Number(fr[1]), Number(fr[2]), Number(fr[3])];
  } else {
    return fail('Date invalide (format JJ/MM/AAAA)');
  }

  if (!isValidCalendarDate(year, month, day)) return fail('Date inexistante');
  return ok(`${year}-${pad2(month)}-${pad2(day)}`);
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function parsePhone(input: unknown): ParseResult {
  if (typeof input !== 'string' && typeof input !== 'number') {
    return fail('Numéro de téléphone invalide');
  }
  const text = String(input).trim();
  if (text.length > 30) return fail('Numéro de téléphone invalide');
  const phone = parsePhoneNumberFromString(text, DEFAULT_PHONE_COUNTRY);
  if (!phone || !phone.isValid()) return fail('Numéro de téléphone invalide');
  return ok(phone.number);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
