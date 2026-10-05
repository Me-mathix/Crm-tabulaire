import { useCallback, useEffect, useReducer, useRef } from 'react';
import { DEFAULT_PAGE_SIZE, type CellValue, type Contact, type FilterInput, type SortInput } from '@crm/shared';
import { ApiError, api, messageOf } from '../lib/api';
import { contactsReducer, hasMorePages, INITIAL_CONTACTS_STATE } from './contactsReducer';

export interface ContactsView {
  sort?: SortInput;
  filters: FilterInput[];
}

/**
 * Contacts paginés (scroll infini). Le tri et les filtres sont appliqués par l'API :
 * changer la vue recharge la liste depuis le début.
 */
export function useContacts(view: ContactsView, enabled: boolean, notify: (message: string) => void) {
  const [state, dispatch] = useReducer(contactsReducer, INITIAL_CONTACTS_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const viewRef = useRef(view);
  viewRef.current = view;

  // Chaque rechargement complet ouvre une « génération » : les réponses d'une
  // génération précédente (ancien tri / anciens filtres) sont ignorées.
  const generation = useRef(0);
  const inFlight = useRef(false);

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!reset && inFlight.current) return;
    const gen = reset ? ++generation.current : generation.current;
    inFlight.current = true;
    const offset = reset ? 0 : stateRef.current.serverOffset;
    dispatch({ type: reset ? 'reset' : 'loading' });
    try {
      const { sort, filters } = viewRef.current;
      const page = await api.listContacts({ limit: DEFAULT_PAGE_SIZE, offset, sort, filters });
      if (gen === generation.current) dispatch({ type: 'page', page, reset });
    } catch (e) {
      if (gen === generation.current) dispatch({ type: 'error', message: messageOf(e) });
    } finally {
      if (gen === generation.current) inFlight.current = false;
    }
  }, []);

  const viewKey = JSON.stringify(view);
  useEffect(() => {
    if (enabled) void fetchPage(true);
  }, [enabled, viewKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (hasMorePages(stateRef.current) && !stateRef.current.loading) void fetchPage(false);
  }, [fetchPage]);

  const retry = useCallback(() => {
    void fetchPage(stateRef.current.rows.length === 0);
  }, [fetchPage]);

  const reload = useCallback(() => void fetchPage(true), [fetchPage]);

  /** Mise à jour optimiste d'une cellule. Renvoie le message d'erreur, ou null si enregistré. */
  const updateCell = useCallback(
    async (contact: Contact, fieldId: string, value: CellValue | null): Promise<string | null> => {
      const previous = contact.values[fieldId] ?? null;
      dispatch({ type: 'setField', id: contact.id, fieldId, value });
      try {
        const saved = await api.updateContact(contact.id, { [fieldId]: value });
        dispatch({ type: 'setField', id: contact.id, fieldId, value: saved.values[fieldId] ?? null });
        return null;
      } catch (e) {
        dispatch({ type: 'setField', id: contact.id, fieldId, value: previous });
        if (e instanceof ApiError) return e.body.fieldErrors?.[fieldId] ?? e.message;
        return messageOf(e);
      }
    },
    [],
  );

  /** Crée un contact vide, affiché en haut de la liste. */
  const addContact = useCallback(async (): Promise<Contact | null> => {
    try {
      const contact = await api.createContact();
      const { sort, filters } = viewRef.current;
      // Dans l'ordre par défaut (plus récent d'abord), le nouveau contact est aussi
      // le premier côté serveur : les offsets suivants sont décalés d'une ligne.
      dispatch({ type: 'insert', contact, shiftsOffset: !sort && filters.length === 0 });
      return contact;
    } catch (e) {
      notify(`Contact non créé : ${messageOf(e)}`);
      return null;
    }
  }, [notify]);

  const deleteContact = useCallback(
    async (id: string) => {
      try {
        await api.deleteContact(id);
        dispatch({ type: 'remove', id });
      } catch (e) {
        notify(`Contact non supprimé : ${messageOf(e)}`);
      }
    },
    [notify],
  );

  return {
    ...state,
    hasMore: hasMorePages(state),
    loadMore,
    retry,
    reload,
    updateCell,
    addContact,
    deleteContact,
  };
}
