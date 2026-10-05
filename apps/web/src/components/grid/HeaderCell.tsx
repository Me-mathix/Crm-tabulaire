import { useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { Field, SortDirection } from '@crm/shared';
import { FIELD_TYPE_LABELS } from '@crm/shared';
import { clampWidth } from '../../lib/columns';
import styles from './Grid.module.css';

export const FIELD_DRAG_TYPE = 'application/x-crm-field';

const TYPE_ICONS: Record<Field['type'], string> = {
  text: 'Aa',
  number: '#',
  date: '31',
  phone: 'Tél',
};

interface HeaderCellProps {
  field: Field;
  index: number;
  width: number;
  sortDirection?: SortDirection;
  menuOpen: boolean;
  onSortToggle: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
  onResizeLive: (width: number) => void;
  onResizeEnd: (width: number) => void;
  onDropField: (draggedId: string, target: number, side: 'before' | 'after') => void;
}

export function HeaderCell(props: HeaderCellProps) {
  const { field, index, width, sortDirection } = props;
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const [dragging, setDragging] = useState(false);
  const resizing = useRef(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  /* ----- Réorganisation par glisser-déposer (API native du navigateur) ----- */

  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (resizing.current) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(FIELD_DRAG_TYPE, field.id);
    event.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  };

  const sideOf = (event: DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(FIELD_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropSide(sideOf(event));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const draggedId = event.dataTransfer.getData(FIELD_DRAG_TYPE);
    setDropSide(null);
    if (!draggedId) return;
    event.preventDefault();
    props.onDropField(draggedId, index, sideOf(event));
  };

  /* ----- Redimensionnement ----- */

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = true;
    const handle = event.currentTarget;
    const startX = event.clientX;
    let last = width;
    handle.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      last = clampWidth(width + e.clientX - startX);
      props.onResizeLive(last);
    };
    const onUp = () => {
      resizing.current = false;
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      props.onResizeEnd(last);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const sortLabel = sortDirection === 'asc' ? 'croissant' : sortDirection === 'desc' ? 'décroissant' : null;

  return (
    <div
      role="columnheader"
      aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'}
      aria-colindex={index + 2}
      className={[
        styles.headerCell,
        dragging ? styles.dragging : '',
        dropSide === 'before' ? styles.dropBefore : '',
        dropSide === 'after' ? styles.dropAfter : '',
      ].join(' ')}
      style={{ width }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={() => setDragging(false)}
      onDragOver={onDragOver}
      onDragLeave={() => setDropSide(null)}
      onDrop={onDrop}
    >
      <button
        type="button"
        className={styles.headerLabel}
        onClick={props.onSortToggle}
        title={`${field.label} (${FIELD_TYPE_LABELS[field.type]}) — cliquer pour trier`}
      >
        <span className={styles.typeIcon} aria-hidden="true">
          {TYPE_ICONS[field.type]}
        </span>
        <span className={styles.labelText}>{field.label}</span>
        {sortDirection && (
          <span className={styles.sortMark} aria-label={`tri ${sortLabel}`}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
      <button
        ref={menuButton}
        type="button"
        className={styles.menuButton}
        aria-label={`Options de la colonne ${field.label}`}
        aria-haspopup="menu"
        aria-expanded={props.menuOpen}
        onClick={() => menuButton.current && props.onOpenMenu(menuButton.current)}
      >
        ⋯
      </button>
      <div
        className={styles.resizeHandle}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionner la colonne ${field.label}`}
        onPointerDown={onResizePointerDown}
      />
    </div>
  );
}
