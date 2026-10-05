import type { Pool } from 'pg';

interface Migration {
  id: string;
  sql: string;
}

/**
 * Migrations SQL, appliquées dans l'ordre au démarrage de l'API (et par le seed).
 * Ne jamais modifier une migration déjà appliquée : en ajouter une nouvelle.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE fields (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        label       text NOT NULL CHECK (length(btrim(label)) > 0),
        type        text NOT NULL CHECK (type IN ('text', 'number', 'date', 'phone')),
        position    integer NOT NULL,
        width       integer NOT NULL DEFAULT 180,
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX fields_label_unique ON fields (lower(label));

      -- Valeurs des cellules : { "<field id>": valeur }. Cellule vide = clé absente.
      CREATE TABLE contacts (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data        jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX contacts_default_order_idx ON contacts (created_at DESC, id DESC);
      CREATE INDEX contacts_data_gin_idx ON contacts USING gin (data);
    `,
  },
];

const MIGRATION_LOCK_ID = 727_001;

export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('BEGIN');
    // Empêche deux processus (API + seed) d'appliquer les migrations en même temps
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
    const done = new Set(rows.map((row) => row.id));

    for (const migration of MIGRATIONS) {
      if (done.has(migration.id)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      applied.push(migration.id);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
