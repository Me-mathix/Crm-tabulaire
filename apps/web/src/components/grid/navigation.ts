export interface CellPos {
  row: number;
  col: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Position suivante après une touche de navigation, ou `null` si la touche
 * ne déplace pas la sélection (ou sort de la grille, comme Tab sur la dernière cellule).
 */
export function nextPosition(
  pos: CellPos,
  key: string,
  shift: boolean,
  rowCount: number,
  colCount: number,
  pageSize = 10,
): CellPos | null {
  if (rowCount === 0 || colCount === 0) return null;
  const lastRow = rowCount - 1;
  const lastCol = colCount - 1;

  switch (key) {
    case 'ArrowUp':
      return { row: clamp(pos.row - 1, 0, lastRow), col: pos.col };
    case 'ArrowDown':
      return { row: clamp(pos.row + 1, 0, lastRow), col: pos.col };
    case 'ArrowLeft':
      return { row: pos.row, col: clamp(pos.col - 1, 0, lastCol) };
    case 'ArrowRight':
      return { row: pos.row, col: clamp(pos.col + 1, 0, lastCol) };
    case 'Home':
      return { row: pos.row, col: 0 };
    case 'End':
      return { row: pos.row, col: lastCol };
    case 'PageUp':
      return { row: clamp(pos.row - pageSize, 0, lastRow), col: pos.col };
    case 'PageDown':
      return { row: clamp(pos.row + pageSize, 0, lastRow), col: pos.col };
    case 'Tab': {
      // Tab avance cellule par cellule et passe à la ligne suivante en fin de ligne
      const index = pos.row * colCount + pos.col + (shift ? -1 : 1);
      if (index < 0 || index > rowCount * colCount - 1) return null;
      return { row: Math.floor(index / colCount), col: index % colCount };
    }
    default:
      return null;
  }
}

/** Touche qui commence la saisie dans la cellule (comme dans un tableur). */
export function isPrintableKey(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}
