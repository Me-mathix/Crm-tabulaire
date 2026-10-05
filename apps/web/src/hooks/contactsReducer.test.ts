import { describe, expect, it } from 'vitest';
import type { Contact } from '@crm/shared';
import { contactsReducer, hasMorePages, INITIAL_CONTACTS_STATE, type ContactsState } from './contactsReducer';

const contact = (id: string, values: Contact['values'] = {}): Contact => ({
  id,
  values,
  createdAt: '2026-10-05T10:00:00.000Z',
  updatedAt: '2026-10-05T10:00:00.000Z',
});
const page = (ids: string[], total: number, offset = 0) => ({
  items: ids.map((id) => contact(id)),
  total,
  limit: 50,
  offset,
});

describe('contactsReducer', () => {
  it('ajoute les pages à la suite et calcule s’il en reste', () => {
    let state = contactsReducer(INITIAL_CONTACTS_STATE, { type: 'reset' });
    state = contactsReducer(state, { type: 'page', page: page(['a', 'b'], 3), reset: true });
    expect(state.rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(hasMorePages(state)).toBe(true);
    state = contactsReducer(state, { type: 'page', page: page(['c'], 3, 2), reset: false });
    expect(state.serverOffset).toBe(3);
    expect(hasMorePages(state)).toBe(false);
  });

  it('un contact ajouté localement décale l’offset et n’est pas dupliqué ensuite', () => {
    let state: ContactsState = contactsReducer(INITIAL_CONTACTS_STATE, {
      type: 'page',
      page: page(['a', 'b'], 4),
      reset: true,
    });
    state = contactsReducer(state, { type: 'insert', contact: contact('new'), shiftsOffset: true });
    expect(state.total).toBe(5);
    expect(state.serverOffset).toBe(3);
    // La page suivante peut contenir le nouveau contact : il n'apparaît qu'une fois
    state = contactsReducer(state, { type: 'page', page: page(['new', 'c'], 5, 3), reset: false });
    expect(state.rows.map((r) => r.id)).toEqual(['new', 'a', 'b', 'c']);
  });

  it('une suppression décale l’offset pour ne pas sauter de ligne', () => {
    let state = contactsReducer(INITIAL_CONTACTS_STATE, { type: 'page', page: page(['a', 'b'], 4), reset: true });
    state = contactsReducer(state, { type: 'remove', id: 'a' });
    expect(state.rows.map((r) => r.id)).toEqual(['b']);
    expect(state.serverOffset).toBe(1);
    expect(state.total).toBe(3);
  });

  it('modifie ou vide une seule cellule', () => {
    let state = contactsReducer(INITIAL_CONTACTS_STATE, {
      type: 'page',
      page: { items: [contact('a', { name: 'Ana', score: 3 })], total: 1, limit: 50, offset: 0 },
      reset: true,
    });
    state = contactsReducer(state, { type: 'setField', id: 'a', fieldId: 'score', value: 7 });
    expect(state.rows[0].values).toEqual({ name: 'Ana', score: 7 });
    state = contactsReducer(state, { type: 'setField', id: 'a', fieldId: 'name', value: null });
    expect(state.rows[0].values).toEqual({ score: 7 });
  });

  it('n’annonce plus de page en cas d’erreur (pas de boucle de rechargement)', () => {
    let state = contactsReducer(INITIAL_CONTACTS_STATE, { type: 'page', page: page(['a'], 10), reset: true });
    state = contactsReducer(state, { type: 'error', message: 'Serveur injoignable' });
    expect(hasMorePages(state)).toBe(false);
  });
});
