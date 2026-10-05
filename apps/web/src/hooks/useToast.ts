import { useCallback, useEffect, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
}

/** Un message éphémère à la fois, pour les erreurs d'opérations en arrière-plan. */
export function useToast(durationMs = 6000) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string) => setToast({ id: Date.now(), message }), []);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  return { toast, show, dismiss };
}
