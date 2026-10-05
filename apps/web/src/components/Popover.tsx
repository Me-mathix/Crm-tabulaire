import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';

interface PopoverProps {
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  align?: 'start' | 'end';
  label: string;
}

/**
 * Panneau flottant ancré à un élément (menu de colonne, filtres, formulaires).
 * Rendu dans <body> pour échapper au défilement de la grille. Fermeture par Échap ou clic extérieur.
 */
export function Popover({ anchor, onClose, children, align = 'start', label }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const { offsetWidth: w, offsetHeight: h } = panel;
      let left = align === 'end' ? a.right - w : a.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = a.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, a.top - h - 6);
      setPosition({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, align]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onCloseRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={styles.popover}
      style={position ?? { top: 0, left: 0, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
