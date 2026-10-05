/**
 * Réinitialise la base avec les colonnes par défaut et N contacts fictifs (500 par défaut).
 *   npm run seed -w api            → 500 contacts
 *   npm run seed -w api -- 5000    → 5 000 contacts
 * ⚠ Supprime toutes les colonnes et tous les contacts existants.
 */
import { parseValue, type CellValue } from '@crm/shared';
import { Pool } from 'pg';
import { databaseUrl } from '../database/config';
import { runMigrations } from '../database/migrations';
import { DEFAULT_FIELDS, generateContacts } from './fake-data';

const DEFAULT_COUNT = 500;
const MAX_COUNT = 100_000;

function parseCount(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_COUNT;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`Nombre de contacts invalide : « ${raw} » (entre 1 et ${MAX_COUNT})`);
  }
  return count;
}

async function main(): Promise<void> {
  const count = parseCount(process.argv[2] ?? process.env.SEED_COUNT);
  const pool = new Pool({ connectionString: databaseUrl() });

  try {
    await runMigrations(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE contacts, fields');

      const fieldIds = new Map<string, string>();
      for (const [position, field] of DEFAULT_FIELDS.entries()) {
        const { rows } = await client.query<{ id: string }>(
          'INSERT INTO fields (label, type, position, width) VALUES ($1, $2, $3, $4) RETURNING id',
          [field.label, field.type, position, field.width],
        );
        fieldIds.set(field.key, rows[0].id);
      }

      // Les valeurs passent par la même validation que l'API : le seed ne peut pas
      // produire de données que l'interface refuserait.
      const now = Date.now();
      const records = generateContacts(count).map((fake, index) => {
        const data: Record<string, CellValue> = {};
        for (const field of DEFAULT_FIELDS) {
          const result = parseValue(field.type, fake[field.key]);
          if (result.ok && result.value !== null) data[fieldIds.get(field.key)!] = result.value;
        }
        // Dates de création décroissantes : l'ordre par défaut est déterministe
        return { data, created_at: new Date(now - index * 60_000).toISOString() };
      });

      await client.query(
        `INSERT INTO contacts (data, created_at, updated_at)
         SELECT r.data, r.created_at, r.created_at
         FROM jsonb_to_recordset($1::jsonb) AS r(data jsonb, created_at timestamptz)`,
        [JSON.stringify(records)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(`✔ Base initialisée : ${DEFAULT_FIELDS.length} colonnes, ${count} contacts.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('✘ Échec du seed :', error instanceof Error ? error.message : error);
  process.exit(1);
});
