import { useState, type FormEvent } from 'react';
import { FIELD_TYPE_LABELS, FIELD_TYPES, type FieldType } from '@crm/shared';
import ui from './ui.module.css';
import styles from './AddFieldForm.module.css';

const TYPE_HINTS: Record<FieldType, string> = {
  text: 'Nom, entreprise, ville…',
  number: 'Score, montant, quantité…',
  date: 'Dernier contact, échéance…',
  phone: 'Numéro validé et formaté',
};

interface AddFieldFormProps {
  onCreate: (label: string, type: FieldType) => Promise<string | null>;
  onClose: () => void;
}

export function AddFieldForm({ onCreate, onClose }: AddFieldFormProps) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return setError('Donnez un nom à la colonne');
    setSaving(true);
    const message = await onCreate(trimmed, type);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <form className={ui.form} onSubmit={submit} style={{ width: 300 }}>
      <label className={ui.field}>
        Nom de la colonne
        <input
          className={ui.input}
          value={label}
          autoFocus
          maxLength={100}
          placeholder="ex. Email, Chiffre d’affaires…"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
        />
      </label>
      <fieldset className={styles.types}>
        <legend className={ui.field}>Type</legend>
        {FIELD_TYPES.map((t) => (
          <label key={t} className={styles.type}>
            <input type="radio" name="field-type" value={t} checked={type === t} onChange={() => setType(t)} />
            <span>
              <strong>{FIELD_TYPE_LABELS[t]}</strong>
              <small>{TYPE_HINTS[t]}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className={ui.hint}>Le type ne pourra plus être changé ensuite.</p>
      {error && <p className={ui.error}>{error}</p>}
      <div className={ui.actions}>
        <button type="button" className={ui.ghost} onClick={onClose}>
          Annuler
        </button>
        <button type="submit" className={ui.primary} disabled={saving}>
          Ajouter la colonne
        </button>
      </div>
    </form>
  );
}
