import { useCallback, useEffect, useRef, useState } from 'react';
import type { Field, FieldType } from '@crm/shared';
import { api, messageOf } from '../lib/api';
import { moveItem } from '../lib/columns';

/** Colonnes de la grille, avec leurs opérations. */
export function useFields(notify: (message: string) => void) {
  const [fields, setFields] = useState<Field[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldsRef = useRef<Field[]>([]);
  fieldsRef.current = fields ?? [];

  const load = useCallback(async () => {
    setError(null);
    try {
      setFields(await api.listFields());
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Lève une ApiError : le formulaire affiche le message (nom déjà pris…). */
  const create = useCallback(async (label: string, type: FieldType) => {
    const field = await api.createField(label, type);
    setFields((prev) => [...(prev ?? []), field]);
    return field;
  }, []);

  const rename = useCallback(async (id: string, label: string) => {
    const field = await api.updateField(id, { label });
    setFields((prev) => prev?.map((f) => (f.id === id ? field : f)) ?? prev);
  }, []);

  const resize = useCallback(
    async (id: string, width: number) => {
      const previous = fieldsRef.current.find((f) => f.id === id)?.width;
      setFields((prev) => prev?.map((f) => (f.id === id ? { ...f, width } : f)) ?? prev);
      try {
        await api.updateField(id, { width });
      } catch (e) {
        if (previous !== undefined) {
          setFields((prev) => prev?.map((f) => (f.id === id ? { ...f, width: previous } : f)) ?? prev);
        }
        notify(`Largeur non enregistrée : ${messageOf(e)}`);
      }
    },
    [notify],
  );

  /** Mise à jour optimiste de l'ordre, annulée si l'API refuse. */
  const move = useCallback(
    async (id: string, toIndex: number) => {
      const previous = fieldsRef.current;
      const from = previous.findIndex((f) => f.id === id);
      if (from < 0 || from === toIndex) return;
      const next = moveItem(previous, from, toIndex);
      setFields(next);
      try {
        setFields(await api.reorderFields(next.map((f) => f.id)));
      } catch (e) {
        setFields(previous);
        notify(`Ordre des colonnes non enregistré : ${messageOf(e)}`);
      }
    },
    [notify],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.deleteField(id);
        setFields((prev) => prev?.filter((f) => f.id !== id) ?? prev);
      } catch (e) {
        notify(`Colonne non supprimée : ${messageOf(e)}`);
      }
    },
    [notify],
  );

  return { fields, error, reload: load, create, rename, resize, move, remove };
}
