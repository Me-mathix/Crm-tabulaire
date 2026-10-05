import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateFieldInput,
  Field,
  FieldType,
  FieldTypeMap,
  UpdateFieldInput,
} from '@crm/shared';
import type { PoolClient } from 'pg';
import { DatabaseService, isUniqueViolation } from '../database/database.service';

interface FieldRow {
  id: string;
  label: string;
  type: FieldType;
  position: number;
  width: number;
}

const FIELD_COLUMNS = 'id, label, type, position, width';
const DUPLICATE_LABEL = 'Une colonne porte déjà ce nom';

@Injectable()
export class FieldsService {
  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<Field[]> {
    const { rows } = await this.db.query<FieldRow>(
      `SELECT ${FIELD_COLUMNS} FROM fields ORDER BY position, created_at`,
    );
    return rows;
  }

  async typeMap(): Promise<FieldTypeMap> {
    const { rows } = await this.db.query<{ id: string; type: FieldType }>('SELECT id, type FROM fields');
    return new Map(rows.map((row) => [row.id, row.type]));
  }

  async create(input: CreateFieldInput): Promise<Field> {
    try {
      const { rows } = await this.db.query<FieldRow>(
        `INSERT INTO fields (label, type, position)
         VALUES ($1, $2, (SELECT coalesce(max(position), -1) + 1 FROM fields))
         RETURNING ${FIELD_COLUMNS}`,
        [input.label, input.type],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException({ message: DUPLICATE_LABEL });
      throw error;
    }
  }

  /** Renommer ou redimensionner. Le type n'est pas modifiable (pas de conversion de données). */
  async update(id: string, input: UpdateFieldInput): Promise<Field> {
    const values: unknown[] = [id];
    const sets: string[] = [];
    if (input.label !== undefined) {
      values.push(input.label);
      sets.push(`label = $${values.length}`);
    }
    if (input.width !== undefined) {
      values.push(input.width);
      sets.push(`width = $${values.length}`);
    }

    try {
      const { rows } = await this.db.query<FieldRow>(
        `UPDATE fields SET ${sets.join(', ')} WHERE id = $1 RETURNING ${FIELD_COLUMNS}`,
        values,
      );
      if (rows.length === 0) throw new NotFoundException({ message: 'Colonne introuvable' });
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException({ message: DUPLICATE_LABEL });
      throw error;
    }
  }

  /** `ids` doit contenir toutes les colonnes, dans le nouvel ordre. */
  async reorder(ids: string[]): Promise<Field[]> {
    return this.db.transaction(async (client) => {
      const { rows } = await client.query<{ id: string }>('SELECT id FROM fields FOR UPDATE');
      const existing = new Set(rows.map((row) => row.id));
      if (ids.length !== existing.size || ids.some((id) => !existing.has(id))) {
        throw new BadRequestException({
          message: 'La liste doit contenir exactement toutes les colonnes existantes',
        });
      }
      await client.query(
        `UPDATE fields f
         SET position = o.ord - 1
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, ord)
         WHERE f.id = o.id`,
        [ids],
      );
      return this.listWith(client);
    });
  }

  /** Supprime la colonne et ses valeurs dans tous les contacts. */
  async remove(id: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const { rowCount } = await client.query('DELETE FROM fields WHERE id = $1', [id]);
      if (!rowCount) throw new NotFoundException({ message: 'Colonne introuvable' });
      await client.query('UPDATE contacts SET data = data - $1::text WHERE data ? $1::text', [id]);
    });
  }

  private async listWith(client: PoolClient): Promise<Field[]> {
    const { rows } = await client.query<FieldRow>(
      `SELECT ${FIELD_COLUMNS} FROM fields ORDER BY position, created_at`,
    );
    return rows;
  }
}
