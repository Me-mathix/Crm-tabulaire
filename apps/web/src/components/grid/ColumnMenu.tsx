import { useState, type FormEvent } from 'react';
import type { Field, FieldType, SortDirection } from '@crm/shared';
import ui from '../ui.module.css';

const SORT_LABELS: Record<FieldType, Record<SortDirection, string>> = {
  text: { asc: 'Trier de A à Z', desc: 'Trier de Z à A' },
  number: { asc: 'Trier du plus petit au plus grand', desc: 'Trier du plus grand au plus petit' },
  date: { asc: 'Trier du plus ancien au plus récent', desc: 'Trier du plus récent au plus ancien' },
  phone: { asc: 'Trier par numéro croissant', desc: 'Trier par numéro décroissant' },
};

interface ColumnMenuProps {
  field: Field;
  index: number;
  count: number;
  sortDirection?: SortDirection;
  onSort: (direction?: SortDirection) => void;
  onFilter: () => void;
  onRename: (label: string) => Promise<string | null>;
  onMove: (toIndex: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ColumnMenu(props: ColumnMenuProps) {
  const { field, index, count, sortDirection, onClose } = props;
  const [mode, setMode] = useState<'menu' | 'rename' | 'delete'>('menu');
  const [label, setLabel] = useState(field.label);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const act = (action: () => void) => () => {
    action();
    onClose();
  };

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return setError('Le nom de la colonne est requis');
    if (trimmed === field.label) return onClose();
    setSaving(true);
    const message = await props.onRename(trimmed);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  };

  if (mode === 'rename') {
    return (
      <form className={ui.form} onSubmit={submitRename}>
        <label className={ui.field}>
          Nom de la colonne
          <input
            className={ui.input}
            value={label}
            autoFocus
            maxLength={100}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setLabel(e.target.value);
              setError(null);
            }}
          />
        </label>
        {error && <p className={ui.error}>{error}</p>}
        <div className={ui.actions}>
          <button type="button" className={ui.ghost} onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className={ui.primary} disabled={saving}>
            Renommer
          </button>
        </div>
      </form>
    );
  }

  if (mode === 'delete') {
    return (
      <div className={ui.form}>
        <p className={ui.hint}>
          Supprimer la colonne « {field.label} » et toutes ses valeurs ? Cette action est définitive.
        </p>
        <div className={ui.actions}>
          <button type="button" className={ui.ghost} onClick={onClose} autoFocus>
            Annuler
          </button>
          <button type="button" className={ui.danger} onClick={act(props.onDelete)}>
            Supprimer la colonne
          </button>
        </div>
      </div>
    );
  }

  const sortItem = (direction: SortDirection) => (
    <li>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={sortDirection === direction}
        className={ui.menuItem}
        onClick={act(() => props.onSort(sortDirection === direction ? undefined : direction))}
      >
        {SORT_LABELS[field.type][direction]}
      </button>
    </li>
  );

  return (
    <ul className={ui.menu} role="menu" aria-label={`Colonne ${field.label}`}>
      {sortItem('asc')}
      {sortItem('desc')}
      {sortDirection && (
        <li>
          <button type="button" role="menuitem" className={ui.menuItem} onClick={act(() => props.onSort(undefined))}>
            Retirer le tri
          </button>
        </li>
      )}
      <li>
        <button type="button" role="menuitem" className={ui.menuItem} onClick={act(props.onFilter)}>
          Filtrer cette colonne…
        </button>
      </li>
      <li className={ui.separator} role="separator" />
      <li>
        <button type="button" role="menuitem" className={ui.menuItem} onClick={() => setMode('rename')} autoFocus>
          Renommer…
        </button>
      </li>
      <li>
        <button
          type="button"
          role="menuitem"
          className={ui.menuItem}
          disabled={index === 0}
          onClick={act(() => props.onMove(index - 1))}
        >
          Déplacer vers la gauche
        </button>
      </li>
      <li>
        <button
          type="button"
          role="menuitem"
          className={ui.menuItem}
          disabled={index === count - 1}
          onClick={act(() => props.onMove(index + 1))}
        >
          Déplacer vers la droite
        </button>
      </li>
      <li className={ui.separator} role="separator" />
      <li>
        <button type="button" role="menuitem" className={ui.menuDanger} onClick={() => setMode('delete')}>
          Supprimer la colonne…
        </button>
      </li>
    </ul>
  );
}
