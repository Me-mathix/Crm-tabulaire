import { useState, type FormEvent } from 'react';
import {
  normalizeFilter,
  operatorLabel,
  OPERATOR_ARITY,
  OPERATORS_BY_TYPE,
  type Field,
  type FieldType,
  type FilterInput,
  type FilterOperator,
} from '@crm/shared';
import ui from '../ui.module.css';

const VALUE_PLACEHOLDERS: Record<FieldType, string> = {
  text: 'Texte recherché',
  number: 'ex. 50',
  date: 'JJ/MM/AAAA',
  phone: 'ex. 06 12',
};

interface FilterEditorProps {
  fields: Field[];
  initial?: FilterInput;
  initialFieldId?: string;
  onApply: (filter: FilterInput) => void;
  onRemove?: () => void;
  onClose: () => void;
}

function valuesOf(filter?: FilterInput): [string, string] {
  if (!filter) return ['', ''];
  if (Array.isArray(filter.value)) return [String(filter.value[0] ?? ''), String(filter.value[1] ?? '')];
  return [filter.value === undefined ? '' : String(filter.value), ''];
}

/** Formulaire d'un filtre : colonne, opérateur (selon le type), puis 0, 1 ou 2 valeurs. */
export function FilterEditor({ fields, initial, initialFieldId, onApply, onRemove, onClose }: FilterEditorProps) {
  const [fieldId, setFieldId] = useState(initial?.fieldId ?? initialFieldId ?? fields[0]?.id ?? '');
  const field = fields.find((f) => f.id === fieldId);
  const type = field?.type ?? 'text';
  const [operator, setOperator] = useState<FilterOperator>(initial?.operator ?? OPERATORS_BY_TYPE[type][0]);
  const [[first, second], setValues] = useState(valuesOf(initial));
  const [error, setError] = useState<string | null>(null);

  const arity = OPERATOR_ARITY[operator];

  const changeField = (id: string) => {
    setFieldId(id);
    setError(null);
    const nextType = fields.find((f) => f.id === id)?.type ?? 'text';
    if (!OPERATORS_BY_TYPE[nextType].includes(operator)) setOperator(OPERATORS_BY_TYPE[nextType][0]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!field) return;
    const filter: FilterInput = {
      fieldId,
      operator,
      value: arity === 2 ? [first, second] : arity === 1 ? first : undefined,
    };
    // Même validation que l'API : une date ou un nombre invalide est signalé ici
    const result = normalizeFilter(type, filter);
    if (!result.ok) return setError(result.error);
    onApply(filter);
    onClose();
  };

  const valueInput = (value: string, index: 0 | 1, label: string) => (
    <input
      className={ui.input}
      value={value}
      aria-label={label}
      placeholder={VALUE_PLACEHOLDERS[type]}
      inputMode={type === 'number' ? 'decimal' : type === 'phone' ? 'tel' : undefined}
      aria-invalid={error ? true : undefined}
      autoFocus={index === 0}
      onChange={(e) => {
        setError(null);
        setValues(index === 0 ? [e.target.value, second] : [first, e.target.value]);
      }}
    />
  );

  return (
    <form className={ui.form} onSubmit={submit} style={{ width: 300 }}>
      <label className={ui.field}>
        Colonne
        <select className={ui.select} value={fieldId} onChange={(e) => changeField(e.target.value)}>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className={ui.field}>
        Condition
        <select
          className={ui.select}
          value={operator}
          onChange={(e) => {
            setOperator(e.target.value as FilterOperator);
            setError(null);
          }}
        >
          {OPERATORS_BY_TYPE[type].map((op) => (
            <option key={op} value={op}>
              {operatorLabel(type, op)}
            </option>
          ))}
        </select>
      </label>
      {arity === 1 && valueInput(first, 0, 'Valeur')}
      {arity === 2 && (
        <div className={ui.row}>
          {valueInput(first, 0, 'Valeur minimale')}
          <span className={ui.hint}>et</span>
          {valueInput(second, 1, 'Valeur maximale')}
        </div>
      )}
      {error && <p className={ui.error}>{error}</p>}
      <div className={ui.actions}>
        {onRemove && (
          <button
            type="button"
            className={ui.ghost}
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            Retirer
          </button>
        )}
        <button type="submit" className={ui.primary}>
          {initial ? 'Mettre à jour' : 'Filtrer'}
        </button>
      </div>
    </form>
  );
}
