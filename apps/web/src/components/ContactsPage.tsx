import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { normalizeFilter, type Contact, type Field, type FieldType, type FilterInput } from '@crm/shared';
import { useContacts, type ContactsView } from '../hooks/useContacts';
import { useFields } from '../hooks/useFields';
import { useToast } from '../hooks/useToast';
import { messageOf } from '../lib/api';
import { readViewFromUrl, writeViewToUrl } from '../lib/viewUrl';
import { AddFieldForm } from './AddFieldForm';
import { FilterBar } from './filters/FilterBar';
import { FilterEditor } from './filters/FilterEditor';
import { Grid, type EditRequest } from './grid/Grid';
import { Popover } from './Popover';
import ui from './ui.module.css';
import styles from './ContactsPage.module.css';

type Panel =
  | { kind: 'filter'; anchor: HTMLElement; index: number | null; fieldId?: string }
  | { kind: 'addField'; anchor: HTMLElement };

/** Retire du tri et des filtres ce qui vise une colonne supprimée ou un opérateur invalide. */
function sanitizeView(view: ContactsView, fields: Field[] | null): ContactsView {
  if (!fields) return view;
  const types = new Map(fields.map((f) => [f.id, f.type]));
  const sort = view.sort && types.has(view.sort.fieldId) ? view.sort : undefined;
  const filters = view.filters.filter((filter) => {
    const type = types.get(filter.fieldId);
    return type !== undefined && normalizeFilter(type, filter).ok;
  });
  return sort === view.sort && filters.length === view.filters.length ? view : { sort, filters };
}

const plural = (n: number, word: string) => `${n.toLocaleString('fr-FR')} ${word}${n > 1 ? 's' : ''}`;

export function ContactsPage() {
  const { toast, show: notify, dismiss } = useToast();
  const columns = useFields(notify);
  const fields = columns.fields;

  const [rawView, setView] = useState<ContactsView>(readViewFromUrl);
  const view = useMemo(() => sanitizeView(rawView, fields), [rawView, fields]);
  useEffect(() => writeViewToUrl(view), [view]);

  const contacts = useContacts(view, fields !== null, notify);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);

  /* ----- Vue (tri, filtres) ----- */

  const setFilters = (update: (filters: FilterInput[]) => FilterInput[]) =>
    setView((prev) => ({ ...sanitizeView(prev, fields), filters: update(sanitizeView(prev, fields).filters) }));

  const applyFilter = (index: number | null, filter: FilterInput) =>
    setFilters((filters) => (index === null ? [...filters, filter] : filters.map((f, i) => (i === index ? filter : f))));

  /* ----- Actions ----- */

  const addContact = async () => {
    const contact = await contacts.addContact();
    if (contact) setEditRequest({ contactId: contact.id, nonce: Date.now() });
  };

  const deleteContact = (contact: Contact) => {
    if (window.confirm('Supprimer ce contact ? Cette action est définitive.')) void contacts.deleteContact(contact.id);
  };

  const { create, rename } = columns;
  const createField = useCallback(
    async (label: string, type: FieldType) => {
      try {
        await create(label, type);
        return null;
      } catch (e) {
        return messageOf(e);
      }
    },
    [create],
  );

  const renameField = useCallback(
    async (id: string, label: string) => {
      try {
        await rename(id, label);
        return null;
      } catch (e) {
        return messageOf(e);
      }
    },
    [rename],
  );

  const closePanel = () => setPanel(null);

  /* ----- Rendu ----- */

  const total = contacts.total;
  const hasFilters = view.filters.length > 0;
  const countText =
    total === null ? '' : hasFilters ? `${plural(total, 'résultat')}` : plural(total, 'contact');

  let content: ReactNode;
  if (columns.error) {
    content = (
      <div className={styles.message}>
        <p>Impossible de charger les colonnes : {columns.error}</p>
        <button type="button" className={ui.button} onClick={() => void columns.reload()}>
          Réessayer
        </button>
      </div>
    );
  } else if (!fields) {
    content = <div className={styles.message}>Chargement…</div>;
  } else if (fields.length === 0) {
    content = (
      <div className={styles.message}>
        <p>Aucune colonne pour l’instant. Ajoutez-en une pour commencer à saisir des contacts.</p>
        <button
          type="button"
          className={ui.primary}
          onClick={(e) => setPanel({ kind: 'addField', anchor: e.currentTarget })}
        >
          Ajouter une colonne
        </button>
      </div>
    );
  } else {
    const emptyMessage =
      contacts.rows.length === 0 && !contacts.loading && !contacts.error ? (
        <div className={styles.overlay}>
          {hasFilters ? (
            <>
              <p>Aucun contact ne correspond à ces filtres.</p>
              <button type="button" className={ui.button} onClick={() => setFilters(() => [])}>
                Retirer les filtres
              </button>
            </>
          ) : (
            <>
              <p>Aucun contact pour l’instant.</p>
              <p className={styles.small}>
                Ajoutez-en un, ou remplissez la base avec 500 contacts fictifs : <code>npm run seed</code>
              </p>
            </>
          )}
        </div>
      ) : null;

    content = (
      <>
        <Grid
          fields={fields}
          rows={contacts.rows}
          loading={contacts.loading}
          hasMore={contacts.hasMore}
          onLoadMore={contacts.loadMore}
          sort={view.sort}
          onSortChange={(sort) => setView((prev) => ({ ...sanitizeView(prev, fields), sort }))}
          onUpdateCell={contacts.updateCell}
          onDeleteContact={deleteContact}
          onRenameField={renameField}
          onResizeField={(id, width) => void columns.resize(id, width)}
          onMoveField={(id, toIndex) => void columns.move(id, toIndex)}
          onDeleteField={(id) => void columns.remove(id)}
          onFilterField={(field, anchor) => setPanel({ kind: 'filter', anchor, index: null, fieldId: field.id })}
          onAddField={(anchor) => setPanel({ kind: 'addField', anchor })}
          onInvalidValue={notify}
          editRequest={editRequest}
        />
        {emptyMessage}
        {contacts.error && (
          <div className={styles.overlay} role="alert">
            <p>Chargement des contacts impossible : {contacts.error}</p>
            <button type="button" className={ui.button} onClick={contacts.retry}>
              Réessayer
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Contacts</h1>
          <span className={styles.count} aria-live="polite">
            {countText}
          </span>
        </div>
        <button type="button" className={ui.primary} onClick={() => void addContact()} disabled={!fields?.length}>
          + Nouveau contact
        </button>
      </header>

      {fields && fields.length > 0 && (
        <FilterBar
          fields={fields}
          filters={view.filters}
          sort={view.sort}
          onEditFilter={(index, anchor) => setPanel({ kind: 'filter', anchor, index })}
          onRemoveFilter={(index) => setFilters((filters) => filters.filter((_, i) => i !== index))}
          onClearFilters={() => setFilters(() => [])}
          onClearSort={() => setView((prev) => ({ ...sanitizeView(prev, fields), sort: undefined }))}
        />
      )}

      <div className={styles.gridArea}>
        {content}
      </div>

      <footer className={styles.status}>
        <span>
          {total !== null && total > 0 && `${contacts.rows.length.toLocaleString('fr-FR')} sur ${total.toLocaleString('fr-FR')} chargés`}
        </span>
        <span>{contacts.loading && 'Chargement…'}</span>
        <span className={styles.keys}>
          Flèches pour se déplacer · Entrée pour modifier · Échap pour annuler
        </span>
      </footer>

      {toast && (
        <div className={styles.toast} role="status" key={toast.id}>
          <span>{toast.message}</span>
          <button type="button" className={styles.toastClose} aria-label="Fermer" onClick={dismiss}>
            ×
          </button>
        </div>
      )}

      {panel?.kind === 'filter' && fields && (
        <Popover anchor={panel.anchor} onClose={closePanel} label="Filtre">
          <FilterEditor
            fields={fields}
            initial={panel.index === null ? undefined : view.filters[panel.index]}
            initialFieldId={panel.fieldId}
            onApply={(filter) => applyFilter(panel.index, filter)}
            onRemove={
              panel.index === null
                ? undefined
                : () => setFilters((filters) => filters.filter((_, i) => i !== panel.index))
            }
            onClose={closePanel}
          />
        </Popover>
      )}

      {panel?.kind === 'addField' && (
        <Popover anchor={panel.anchor} onClose={closePanel} align="end" label="Nouvelle colonne">
          <AddFieldForm onCreate={createField} onClose={closePanel} />
        </Popover>
      )}
    </div>
  );
}
