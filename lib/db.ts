import { Pool } from "pg";

const connectionString = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]*/g, "");

const g = globalThis as unknown as { pgPool?: Pool };
export const pool = g.pgPool ?? new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
});
if (process.env.NODE_ENV !== "production") g.pgPool = pool;

export async function query<T = any>(t: string, p: any[] = []) {
  return (await pool.query(t, p)).rows as T[];
}
export async function queryOne<T = any>(t: string, p: any[] = []) {
  return (await query<T>(t, p))[0] ?? null;
}