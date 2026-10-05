export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgres://crm:crm@localhost:5432/crm';
}
