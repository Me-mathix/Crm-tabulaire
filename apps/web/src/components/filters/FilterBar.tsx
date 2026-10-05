import { useRef } from 'react';
import {
  operatorLabel,
  OPERATOR_ARITY,
  type Field,
  type FilterInput,
  type SortInput,
} from '@crm/shared';
import ui from '../ui.module.css';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  fields: Field[];
  filters: FilterInput[];
  sort?: SortInput;
  onEditFilter: (index: number | null, anchor: HTMLElement) => void;
  onRemoveFilter: (index: number) => void;
  onClearFilters: () => void;
  onClearSort: () => void;
}

export function describeFilter(field: Field, filter: FilterInput): string {
  const op = operatorLabel(field.type, filter.operator);
  const arity = OPERATOR_ARITY[filter.operator];
  if (arity === 0) return `${field.label} ${op}`;
  if (arity === 2 && Array.isArray(filter.value)) {
    return `${field.label} ${op} ${String(filter.value[0])} et ${String(filter.value[1])}`;
  }
  return `${field.label} ${op} « ${String(filter.value ?? '')} »`;
}

/** Filtres actifs et tri, sous forme d'étiquettes modifiables. */
export function FilterBar({ fields, filters, sort, ...actions }: FilterBarProps) {
  const addButton = useRef<HTMLButtonElement>(null);
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const sortField = sort ? fieldById.get(sort.fieldId) : undefined;

  return (
    <div className={styles.bar} role="toolbar" aria-label="Filtres et tri">
      {filters.map((filter, index) => {
        const field = fieldById.get(filter.fieldId);
        if (!field) return null;
        const text = describeFilter(field, filter);
        return (
          <span key={index} className={styles.chip}>
            <button
              type="button"
              className={styles.chipLabel}
              onClick={(e) => actions.onEditFilter(index, e.currentTarget)}
              title="Modifier le filtre"
            >
              {text}
            </button>
            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`Retirer le filtre ${text}`}
              onClick={() => actions.onRemoveFilter(index)}
            >
              ×
            </button>
          </span>
        );
      })}

      <button
        ref={addButton}
        type="button"
        className={ui.ghost}
        disabled={fields.length === 0}
        onClick={() => addButton.current && actions.onEditFilter(null, addButton.current)}
      >
        + Ajouter un filtre
      </button>
      {filters.length > 1 && (
        <button type="button" className={styles.link} onClick={actions.onClearFilters}>
          Retirer les filtres
        </button>
      )}

      {sortField && sort && (
        <span className={styles.sortChip}>
          Trié par {sortField.label}, {sort.direction === 'asc' ? 'ordre croissant' : 'ordre décroissant'}
          <button
            type="button"
            className={styles.chipRemove}
            aria-label="Retirer le tri"
            onClick={actions.onClearSort}
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
