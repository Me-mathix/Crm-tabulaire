import { describe, expect, it } from 'vitest';
import { clampWidth, dropIndex, moveItem } from './columns';

describe('moveItem', () => {
  it('déplace un élément vers son index final', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('dropIndex', () => {
  it('calcule l’index final selon le côté de dépôt', () => {
    // a b c d : déposer « a » après « c » → b c a d
    expect(dropIndex(0, 2, 'after')).toBe(2);
    // déposer « d » avant « a » → d a b c
    expect(dropIndex(3, 0, 'before')).toBe(0);
    // déposer « b » juste avant « c » : aucune modification
    expect(dropIndex(1, 2, 'before')).toBe(1);
  });

  it('donne le même résultat que moveItem appliqué à la main', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(moveItem(items, 0, dropIndex(0, 3, 'after'))).toEqual(['b', 'c', 'd', 'a']);
  });
});

describe('clampWidth', () => {
  it('borne et arrondit la largeur', () => {
    expect(clampWidth(10)).toBe(60);
    expect(clampWidth(5000)).toBe(1000);
    expect(clampWidth(180.6)).toBe(181);
  });
});
