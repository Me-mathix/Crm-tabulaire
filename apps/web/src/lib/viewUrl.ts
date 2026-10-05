import { encodeListContactsQuery, listContactsQuerySchema } from '@crm/shared';
import type { ContactsView } from '../hooks/useContacts';

/** Tri et filtres sont conservés dans l'URL : ils survivent au rechargement et se partagent. */
export function readViewFromUrl(): ContactsView {
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const parsed = listContactsQuerySchema.safeParse({ sort: params.sort, filters: params.filters });
  return parsed.success ? { sort: parsed.data.sort, filters: parsed.data.filters } : { filters: [] };
}

export function writeViewToUrl(view: ContactsView): void {
  const query = encodeListContactsQuery({ sort: view.sort, filters: view.filters });
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  if (url !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, '', url);
  }
}
