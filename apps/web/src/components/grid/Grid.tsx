import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  formatValue,
  parseValue,
  toEditableString,
  type CellValue,
  type Contact,
  type Field,
  type SortDirection,
  type SortInput,
} from '@crm/shared';
import { dropIndex } from '../../lib/columns';
import { Popover } from '../Popover';
import { ColumnMenu } from './ColumnMenu';
import { HeaderCell } from './HeaderCell';
import { isPrintableKey, nextPosition, type CellPos } from './navigation';
import styles from './Grid.module.css';

export const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const ROW_NUMBER_WIDTH = 64;
const ADD_COLUMN_WIDTH = 48;
/** On charge la page suivante quand il reste moins de N lignes chargées sous l'écran. */
const LOAD_AHEAD = 20;

const PLACEHOLDERS: Record<Field['type'], string> = {
  text: '',
  number: 'ex. 42',
  date: 'JJ/MM/AAAA',
  phone: 'ex. 06 12 34 56 78',
};

/** La cellule active est repérée par identifiants : elle reste la même si des lignes sont insérées. */
interface ActiveCell {
  rowId: string;
  fieldId: string;
}

interface EditState {
  draft: string;
  error: string | null;
}

export interface EditRequest {
  contactId: string;
  nonce: number;
}

interface GridProps {
  fields: Field[];
  rows: Contact[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  sort?: SortInput;
  onSortChange: (sort?: SortInput) => void;
  onUpdateCell: (contact: Contact, fieldId: string, value: CellValue | null) => Promise<string | null>;
  onDeleteContact: (contact: Contact) => void;
  onRenameField: (id: string, label: string) => Promise<string | null>;
  onResizeField: (id: string, width: number) => void;
  onMoveField: (id: string, toIndex: number) => void;
  onDeleteField: (id: string) => void;
  onFilterField: (field: Field, anchor: HTMLElement) => void;
  onAddField: (anchor: HTMLElement) => void;
  onInvalidValue: (message: string) => void;
  editRequest: EditRequest | null;
}

const cellKey = (rowId: string, fieldId: string) => `${rowId}:${fieldId}`;

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const copy = { ...record };
  delete copy[key];
  return copy;
}

export function Grid(props: GridProps) {
  const { fields, rows, sort } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const addColumnButton = useRef<HTMLButtonElement>(null);

  const [active, setActive] = useState<ActiveCell | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});
  const [menu, setMenu] = useState<{ fieldId: string; anchor: HTMLElement } | null>(null);

  const activeRef = useRef(active);
  activeRef.current = active;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  /* ----- Géométrie des colonnes ----- */

  const widths = useMemo(() => fields.map((f) => liveWidths[f.id] ?? f.width), [fields, liveWidths]);
  const offsets = useMemo(() => {
    const result: number[] = [];
    widths.reduce((left, width) => {
      result.push(left);
      return left + width;
    }, ROW_NUMBER_WIDTH);
    return result;
  }, [widths]);
  const totalWidth = ROW_NUMBER_WIDTH + widths.reduce((sum, w) => sum + w, 0) + ADD_COLUMN_WIDTH;

  const rowIndex = useMemo(() => new Map(rows.map((row, i) => [row.id, i])), [rows]);
  const colIndex = useMemo(() => new Map(fields.map((field, i) => [field.id, i])), [fields]);

  const activePos: CellPos | null = useMemo(() => {
    if (!active) return null;
    const row = rowIndex.get(active.rowId);
    const col = colIndex.get(active.fieldId);
    return row === undefined || col === undefined ? null : { row, col };
  }, [active, rowIndex, colIndex]);

  /* ----- Virtualisation des lignes ----- */

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    paddingStart: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualRows.length > 0 ? virtualRows[virtualRows.length - 1].index : -1;

  const { hasMore, loading, onLoadMore } = props;
  useEffect(() => {
    if (hasMore && !loading && lastVisibleIndex >= rows.length - LOAD_AHEAD) onLoadMore();
  }, [hasMore, loading, lastVisibleIndex, rows.length, onLoadMore]);

  /* ----- Sélection et défilement ----- */

  const select = useCallback(
    (pos: CellPos) => {
      const row = rows[pos.row];
      const field = fields[pos.col];
      if (row && field) setActive({ rowId: row.id, fieldId: field.id });
    },
    [rows, fields],
  );

  const scrollIntoView = useCallback(
    (pos: CellPos) => {
      virtualizer.scrollToIndex(pos.row, { align: 'auto' });
      const container = scrollRef.current;
      if (!container) return;
      const left = offsets[pos.col];
      const right = left + widths[pos.col];
      const visibleLeft = container.scrollLeft + ROW_NUMBER_WIDTH;
      if (left < visibleLeft) container.scrollLeft = left - ROW_NUMBER_WIDTH;
      else if (right > container.scrollLeft + container.clientWidth) {
        container.scrollLeft = right - container.clientWidth;
      }
    },
    [virtualizer, offsets, widths],
  );

  const focusGrid = () => scrollRef.current?.focus({ preventScroll: true });

  /* ----- Édition ----- */

  const startEdit = useCallback(
    (initial?: string) => {
      const pos = activePos;
      if (!pos) return;
      const field = fields[pos.col];
      const row = rows[pos.row];
      scrollIntoView(pos);
      setEditing({ draft: initial ?? toEditableString(field.type, row.values[field.id]), error: null });
    },
    [activePos, fields, rows, scrollIntoView],
  );

  const save = async (contact: Contact, field: Field, value: CellValue | null) => {
    if ((contact.values[field.id] ?? null) === value) return;
    const key = cellKey(contact.id, field.id);
    setCellErrors((prev) => without(prev, key));
    const error = await props.onUpdateCell(contact, field.id, value);
    if (error) setCellErrors((prev) => ({ ...prev, [key]: error }));
  };

  /**
   * Valide la saisie selon le type de la colonne, puis enregistre.
   * - `moveKey` : touche qui a validé (Entrée, Tab), pour déplacer la sélection ensuite
   * - `fromBlur` : la saisie a perdu le focus ; une valeur invalide est alors abandonnée
   */
  const commit = (moveKey?: { key: string; shift: boolean }, fromBlur = false) => {
    const edit = editingRef.current;
    const cell = activeRef.current;
    if (!edit || !cell) return;
    const row = rowIndex.get(cell.rowId);
    const col = colIndex.get(cell.fieldId);
    if (row === undefined || col === undefined) {
      setEditing(null);
      return;
    }
    const contact = rows[row];
    const field = fields[col];
    const parsed = parseValue(field.type, edit.draft);

    if (!parsed.ok) {
      if (fromBlur) {
        editingRef.current = null;
        setEditing(null);
        props.onInvalidValue(`${field.label} : ${parsed.error}. Modification annulée.`);
      } else {
        setEditing({ ...edit, error: parsed.error });
      }
      return;
    }

    editingRef.current = null;
    setEditing(null);
    if (!fromBlur) focusGrid();
    if (moveKey) {
      const next = nextPosition({ row, col }, moveKey.key, moveKey.shift, rows.length, fields.length);
      if (next) {
        select(next);
        scrollIntoView(next);
      }
    }
    void save(contact, field, parsed.value);
  };

  const cancelEdit = () => {
    editingRef.current = null;
    setEditing(null);
    focusGrid();
  };

  // Demande externe : un contact vient d'être créé → on édite sa première cellule
  const { editRequest } = props;
  useEffect(() => {
    if (!editRequest || fields.length === 0) return;
    const row = rowIndex.get(editRequest.contactId);
    if (row === undefined) return;
    setActive({ rowId: editRequest.contactId, fieldId: fields[0].id });
    virtualizer.scrollToIndex(row, { align: 'start' });
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    setEditing({ draft: '', error: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest?.nonce]);

  /* ----- Clavier ----- */

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (editing || event.target !== event.currentTarget || event.nativeEvent.isComposing) return;
    if (!activePos) {
      if (rows.length > 0 && fields.length > 0 && /^(Arrow|Tab|Enter)/.test(event.key) && !event.shiftKey) {
        event.preventDefault();
        select({ row: 0, col: 0 });
      }
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      startEdit();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      void save(rows[activePos.row], fields[activePos.col], null);
      return;
    }
    if (event.key === 'Escape') {
      setActive(null);
      return;
    }
    if (isPrintableKey(event)) {
      event.preventDefault();
      startEdit(event.key);
      return;
    }
    const pageSize = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ROW_HEIGHT) - 2);
    const next = nextPosition(activePos, event.key, event.shiftKey, rows.length, fields.length, pageSize);
    if (next) {
      event.preventDefault();
      select(next);
      scrollIntoView(next);
    }
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commit({ key: event.shiftKey ? 'ArrowUp' : 'ArrowDown', shift: false });
    } else if (event.key === 'Tab') {
      event.preventDefault();
      commit({ key: 'Tab', shift: event.shiftKey });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  };

  // Garde la cellule active cohérente si sa ligne ou sa colonne disparaît
  useLayoutEffect(() => {
    if (active && !activePos) {
      setActive(null);
      setEditing(null);
    }
  }, [active, activePos]);

  /* ----- En-têtes ----- */

  const sortDirectionOf = (fieldId: string): SortDirection | undefined =>
    sort?.fieldId === fieldId ? sort.direction : undefined;

  const toggleSort = (fieldId: string) => {
    const current = sortDirectionOf(fieldId);
    if (!current) props.onSortChange({ fieldId, direction: 'asc' });
    else if (current === 'asc') props.onSortChange({ fieldId, direction: 'desc' });
    else props.onSortChange(undefined);
  };

  const onDropField = (draggedId: string, target: number, side: 'before' | 'after') => {
    const from = colIndex.get(draggedId);
    if (from === undefined) return;
    const to = dropIndex(from, target, side);
    if (to !== from) props.onMoveField(draggedId, to);
  };

  const menuField = menu ? fields.find((f) => f.id === menu.fieldId) : undefined;
  const closeMenu = () => {
    setMenu(null);
    focusGrid();
  };

  const activeCellId = activePos ? `cell-${activePos.row}-${activePos.col}` : undefined;

  return (
    <div
      ref={scrollRef}
      className={styles.scroller}
      role="grid"
      aria-label="Contacts"
      aria-rowcount={rows.length + 1}
      aria-colcount={fields.length + 1}
      aria-activedescendant={editing ? undefined : activeCellId}
      tabIndex={0}
      onKeyDown={onGridKeyDown}
    >
      <div className={styles.canvas} style={{ height: virtualizer.getTotalSize(), width: totalWidth }}>
        <div className={styles.headerRow} role="row" aria-rowindex={1} style={{ height: HEADER_HEIGHT }}>
          <div className={styles.cornerCell} role="columnheader" aria-colindex={1} style={{ width: ROW_NUMBER_WIDTH }}>
            <span className="visually-hidden">Ligne</span>
          </div>
          {fields.map((field, index) => (
            <HeaderCell
              key={field.id}
              field={field}
              index={index}
              width={widths[index]}
              sortDirection={sortDirectionOf(field.id)}
              menuOpen={menu?.fieldId === field.id}
              onSortToggle={() => toggleSort(field.id)}
              onOpenMenu={(anchor) => setMenu({ fieldId: field.id, anchor })}
              onResizeLive={(width) => setLiveWidths((prev) => ({ ...prev, [field.id]: width }))}
              onResizeEnd={(width) => {
                setLiveWidths((prev) => without(prev, field.id));
                if (width !== field.width) props.onResizeField(field.id, width);
              }}
              onDropField={onDropField}
            />
          ))}
          <div className={styles.addColumnCell} style={{ width: ADD_COLUMN_WIDTH }}>
            <button
              ref={addColumnButton}
              type="button"
              className={styles.addColumnButton}
              aria-label="Ajouter une colonne"
              title="Ajouter une colonne"
              onClick={() => addColumnButton.current && props.onAddField(addColumnButton.current)}
            >
              +
            </button>
          </div>
        </div>

        {virtualRows.map((virtualRow) => {
          const contact = rows[virtualRow.index];
          const isActiveRow = activePos?.row === virtualRow.index;
          return (
            <div
              key={virtualRow.key}
              role="row"
              aria-rowindex={virtualRow.index + 2}
              className={[styles.row, isActiveRow ? styles.activeRow : ''].join(' ')}
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: ROW_HEIGHT,
                width: totalWidth,
                zIndex: isActiveRow && editing ? 3 : undefined,
              }}
            >
              <div className={styles.rowNumber} role="rowheader" style={{ width: ROW_NUMBER_WIDTH }}>
                <span className={styles.rowIndex}>{virtualRow.index + 1}</span>
                <button
                  type="button"
                  className={styles.deleteRow}
                  aria-label={`Supprimer le contact ligne ${virtualRow.index + 1}`}
                  title="Supprimer le contact"
                  tabIndex={-1}
                  onClick={() => props.onDeleteContact(contact)}
                >
                  ×
                </button>
              </div>
              {fields.map((field, col) => {
                const isActive = isActiveRow && activePos?.col === col;
                const isEditing = isActive && editing !== null;
                const error = cellErrors[cellKey(contact.id, field.id)];
                const value = contact.values[field.id];
                return (
                  <div
                    key={field.id}
                    id={`cell-${virtualRow.index}-${col}`}
                    role="gridcell"
                    aria-colindex={col + 2}
                    aria-selected={isActive}
                    aria-invalid={error ? true : undefined}
                    title={error}
                    className={[
                      styles.cell,
                      styles[`type_${field.type}`],
                      isActive ? styles.activeCell : '',
                      error ? styles.errorCell : '',
                    ].join(' ')}
                    style={{ width: widths[col] }}
                    onMouseDown={() => {
                      if (isActive) return;
                      // Valide la saisie en cours sur l'ancienne cellule avant de changer de sélection
                      if (editingRef.current) commit(undefined, true);
                      setActive({ rowId: contact.id, fieldId: field.id });
                    }}
                    onDoubleClick={() => startEdit()}
                  >
                    {isEditing ? (
                      <>
                        <input
                          className={styles.editor}
                          value={editing.draft}
                          autoFocus
                          onFocus={(e) => {
                            const end = e.currentTarget.value.length;
                            e.currentTarget.setSelectionRange(end, end);
                          }}
                          placeholder={PLACEHOLDERS[field.type]}
                          inputMode={field.type === 'number' ? 'decimal' : field.type === 'phone' ? 'tel' : undefined}
                          aria-label={`${field.label}, ligne ${virtualRow.index + 1}`}
                          aria-invalid={editing.error ? true : undefined}
                          aria-describedby={editing.error ? 'cell-editor-error' : undefined}
                          onChange={(e) => setEditing({ draft: e.target.value, error: null })}
                          onKeyDown={onEditorKeyDown}
                          onBlur={() => commit(undefined, true)}
                        />
                        {editing.error && (
                          <div id="cell-editor-error" role="alert" className={styles.editorError}>
                            {editing.error}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className={styles.cellText}>{formatValue(field.type, value)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {menu && menuField && (
        <Popover anchor={menu.anchor} onClose={closeMenu} align="end" label={`Options de la colonne ${menuField.label}`}>
          <ColumnMenu
            field={menuField}
            index={colIndex.get(menuField.id) ?? 0}
            count={fields.length}
            sortDirection={sortDirectionOf(menuField.id)}
            onSort={(direction) => props.onSortChange(direction ? { fieldId: menuField.id, direction } : undefined)}
            onFilter={() => props.onFilterField(menuField, menu.anchor)}
            onRename={(label) => props.onRenameField(menuField.id, label)}
            onMove={(toIndex) => props.onMoveField(menuField.id, toIndex)}
            onDelete={() => props.onDeleteField(menuField.id)}
            onClose={closeMenu}
          />
        </Popover>
      )}
    </div>
  );
}
