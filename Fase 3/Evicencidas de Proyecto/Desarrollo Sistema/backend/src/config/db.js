import pkg from 'pg';
const { Pool } = pkg;
import { config } from './env.js';

export const pool = new Pool({
  connectionString: config.db.connectionString,
  ssl: { rejectUnauthorized: false }
});

// Helper para query
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}
