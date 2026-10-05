export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 1000;

export function clampWidth(width: number): number {
  return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width)));
}

/** Déplace l'élément `from` pour qu'il se retrouve à l'index `to` du tableau final. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Index final d'une colonne déposée avant ou après la colonne `target`.
 * Ex. : déplacer la colonne 0 « après » la colonne 2 → index final 2.
 */
export function dropIndex(from: number, target: number, side: 'before' | 'after'): number {
  const insertAt = side === 'after' ? target + 1 : target;
  return from < insertAt ? insertAt - 1 : insertAt;
}
