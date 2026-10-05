import type { CellValue, Contact, ContactPage } from '@crm/shared';

/**
 * Liste de contacts chargée page par page.
 * `serverOffset` = nombre de lignes déjà lues côté serveur : c'est l'offset de la page suivante.
 * Il est ajusté quand on ajoute ou supprime un contact localement, pour ne pas sauter
 * ni dupliquer de ligne au chargement suivant.
 */
export interface ContactsState {
  rows: Contact[];
  total: number | null;
  serverOffset: number;
  loading: boolean;
  error: string | null;
}

export type ContactsAction =
  | { type: 'reset' }
  | { type: 'loading' }
  | { type: 'page'; page: ContactPage; reset: boolean }
  | { type: 'error'; message: string }
  | { type: 'setField'; id: string; fieldId: string; value: CellValue | null }
  | { type: 'insert'; contact: Contact; shiftsOffset: boolean }
  | { type: 'remove'; id: string };

export const INITIAL_CONTACTS_STATE: ContactsState = {
  rows: [],
  total: null,
  serverOffset: 0,
  loading: false,
  error: null,
};

export function contactsReducer(state: ContactsState, action: ContactsAction): ContactsState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL_CONTACTS_STATE, loading: true };

    case 'loading':
      return { ...state, loading: true, error: null };

    case 'page': {
      const base = action.reset ? [] : state.rows;
      // Une ligne ajoutée localement peut revenir dans une page : on évite le doublon
      const known = new Set(base.map((row) => row.id));
      const fresh = action.page.items.filter((row) => !known.has(row.id));
      return {
        rows: [...base, ...fresh],
        total: action.page.total,
        serverOffset: (action.reset ? 0 : state.serverOffset) + action.page.items.length,
        loading: false,
        error: null,
      };
    }

    case 'error':
      return { ...state, loading: false, error: action.message };

    case 'setField':
      return {
        ...state,
        rows: state.rows.map((row) => {
          if (row.id !== action.id) return row;
          const values = { ...row.values };
          if (action.value === null) delete values[action.fieldId];
          else values[action.fieldId] = action.value;
          return { ...row, values };
        }),
      };

    case 'insert':
      return {
        ...state,
        rows: [action.contact, ...state.rows],
        total: (state.total ?? 0) + 1,
        serverOffset: state.serverOffset + (action.shiftsOffset ? 1 : 0),
      };

    case 'remove': {
      if (!state.rows.some((row) => row.id === action.id)) return state;
      return {
        ...state,
        rows: state.rows.filter((row) => row.id !== action.id),
        total: state.total === null ? null : Math.max(0, state.total - 1),
        serverOffset: Math.max(0, state.serverOffset - 1),
      };
    }
  }
}

export function hasMorePages(state: ContactsState): boolean {
  return state.total !== null && state.serverOffset < state.total && state.error === null;
}
