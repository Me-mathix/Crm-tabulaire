import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeFilter,
  parseContactValues,
  type Contact,
  type ContactPage,
  type ContactValues,
  type FieldTypeMap,
  type ListContactsQuery,
  type NormalizedFilter,
} from '@crm/shared';
import { DatabaseService } from '../database/database.service';
import { FieldsService } from '../fields/fields.service';
import { buildListQuery, type ListQueryOptions } from './contacts.query';

interface ContactRow {
  id: string;
  data: ContactValues;
  created_at: Date;
  updated_at: Date;
}

const CONTACT_COLUMNS = 'id, data, created_at, updated_at';

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    values: row.data,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly fields: FieldsService,
  ) {}

  async list(query: ListContactsQuery): Promise<ContactPage> {
    const types = await this.fields.typeMap();
    const { list, count } = buildListQuery({
      sort: this.resolveSort(types, query),
      filters: this.resolveFilters(types, query),
      limit: query.limit,
      offset: query.offset,
    });

    const [rows, total] = await Promise.all([
      this.db.query<ContactRow>(list.text, list.values),
      this.db.query<{ total: number }>(count.text, count.values),
    ]);

    return {
      items: rows.rows.map(toContact),
      total: total.rows[0].total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async create(values: Record<string, unknown> = {}): Promise<Contact> {
    const parsed = parseContactValues(await this.fields.typeMap(), values);
    if (!parsed.ok) throw new BadRequestException({ message: 'Valeurs invalides', fieldErrors: parsed.fieldErrors });

    const { rows } = await this.db.query<ContactRow>(
      `INSERT INTO contacts (data) VALUES ($1::jsonb) RETURNING ${CONTACT_COLUMNS}`,
      [parsed.set],
    );
    return toContact(rows[0]);
  }

  /** Mise à jour partielle : seules les colonnes envoyées sont modifiées. */
  async update(id: string, values: Record<string, unknown>): Promise<Contact> {
    const parsed = parseContactValues(await this.fields.typeMap(), values);
    if (!parsed.ok) throw new BadRequestException({ message: 'Valeurs invalides', fieldErrors: parsed.fieldErrors });

    const { rows } = await this.db.query<ContactRow>(
      `UPDATE contacts
       SET data = (data || $2::jsonb) - $3::text[], updated_at = now()
       WHERE id = $1
       RETURNING ${CONTACT_COLUMNS}`,
      [id, parsed.set, parsed.unset],
    );
    if (rows.length === 0) throw new NotFoundException({ message: 'Contact introuvable' });
    return toContact(rows[0]);
  }

  async remove(id: string): Promise<void> {
    const { rowCount } = await this.db.query('DELETE FROM contacts WHERE id = $1', [id]);
    if (!rowCount) throw new NotFoundException({ message: 'Contact introuvable' });
  }

  private resolveSort(types: FieldTypeMap, query: ListContactsQuery): ListQueryOptions['sort'] {
    if (!query.sort) return undefined;
    const type = types.get(query.sort.fieldId);
    if (!type) throw new BadRequestException({ message: 'Colonne de tri inconnue' });
    return { ...query.sort, type };
  }

  private resolveFilters(types: FieldTypeMap, query: ListContactsQuery): NormalizedFilter[] {
    const filters: NormalizedFilter[] = [];
    const errors: string[] = [];
    for (const input of query.filters) {
      const type = types.get(input.fieldId);
      if (!type) {
        errors.push('Colonne de filtre inconnue');
        continue;
      }
      const result = normalizeFilter(type, input);
      if (result.ok) filters.push(result.filter);
      else errors.push(result.error);
    }
    if (errors.length > 0) throw new BadRequestException({ message: 'Filtres invalides', errors });
    return filters;
  }
}
