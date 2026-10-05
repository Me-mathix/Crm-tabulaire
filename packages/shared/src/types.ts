import type { FieldType } from './fieldTypes';
import type { CellValue } from './values';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  position: number;
  width: number;
}

export type ContactValues = Record<string, CellValue>;

export interface Contact {
  id: string;
  values: ContactValues;
  createdAt: string;
  updatedAt: string;
}

export interface ContactPage {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortInput {
  fieldId: string;
  direction: SortDirection;
}

/** Corps des réponses 400 de l'API. */
export interface ApiErrorBody {
  message: string;
  /** Erreur par colonne (validation des valeurs d'un contact). */
  fieldErrors?: Record<string, string>;
  /** Erreurs de forme de la requête ou des filtres. */
  errors?: string[];
}
