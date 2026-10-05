import {
  encodeListContactsQuery,
  type ApiErrorBody,
  type CellValue,
  type Contact,
  type ContactPage,
  type Field,
  type FieldType,
  type FilterInput,
  type SortInput,
} from '@crm/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { message: 'Serveur injoignable. Vérifiez que l’API est démarrée.' });
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const isErrorBody =
      typeof data === 'object' && data !== null && typeof (data as ApiErrorBody).message === 'string';
    throw new ApiError(response.status, isErrorBody ? (data as ApiErrorBody) : { message: `Erreur ${response.status}` });
  }
  return data as T;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur inattendue';
}

export const api = {
  listFields: () => request<Field[]>('GET', '/fields'),
  createField: (label: string, type: FieldType) => request<Field>('POST', '/fields', { label, type }),
  updateField: (id: string, patch: { label?: string; width?: number }) =>
    request<Field>('PATCH', `/fields/${id}`, patch),
  reorderFields: (ids: string[]) => request<Field[]>('PUT', '/fields/order', { ids }),
  deleteField: (id: string) => request<void>('DELETE', `/fields/${id}`),

  listContacts: (query: { limit: number; offset: number; sort?: SortInput; filters: FilterInput[] }) =>
    request<ContactPage>('GET', `/contacts?${encodeListContactsQuery(query)}`),
  createContact: () => request<Contact>('POST', '/contacts', { values: {} }),
  updateContact: (id: string, values: Record<string, CellValue | null>) =>
    request<Contact>('PATCH', `/contacts/${id}`, { values }),
  deleteContact: (id: string) => request<void>('DELETE', `/contacts/${id}`),
};
