import { describe, expect, it } from 'vitest';
import { isPrintableKey, nextPosition } from './navigation';

const move = (key: string, row = 1, col = 1, shift = false) => nextPosition({ row, col }, key, shift, 5, 3, 2);

describe('nextPosition', () => {
  it('déplace avec les flèches sans sortir de la grille', () => {
    expect(move('ArrowUp')).toEqual({ row: 0, col: 1 });
    expect(move('ArrowRight', 1, 2)).toEqual({ row: 1, col: 2 });
    expect(move('ArrowUp', 0)).toEqual({ row: 0, col: 1 });
    expect(move('ArrowDown', 4)).toEqual({ row: 4, col: 1 });
  });

  it('Tab passe à la ligne suivante en fin de ligne, Maj+Tab revient', () => {
    expect(move('Tab', 1, 2)).toEqual({ row: 2, col: 0 });
    expect(move('Tab', 1, 0, true)).toEqual({ row: 0, col: 2 });
  });

  it('Tab sur la dernière cellule laisse sortir de la grille', () => {
    expect(move('Tab', 4, 2)).toBeNull();
    expect(move('Tab', 0, 0, true)).toBeNull();
  });

  it('gère Début, Fin et les pages', () => {
    expect(move('Home', 3, 2)).toEqual({ row: 3, col: 0 });
    expect(move('End', 3, 0)).toEqual({ row: 3, col: 2 });
    expect(move('PageDown', 1)).toEqual({ row: 3, col: 1 });
    expect(move('PageUp', 1)).toEqual({ row: 0, col: 1 });
  });

  it('ignore les autres touches et les grilles vides', () => {
    expect(move('a')).toBeNull();
    expect(nextPosition({ row: 0, col: 0 }, 'ArrowDown', false, 0, 3)).toBeNull();
  });
});

describe('isPrintableKey', () => {
  it('reconnaît une saisie, pas un raccourci', () => {
    const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
      isPrintableKey({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });
    expect(key('a')).toBe(true);
    expect(key('é')).toBe(true);
    expect(key('Enter')).toBe(false);
    expect(key('c', { ctrlKey: true })).toBe(false);
  });
});
