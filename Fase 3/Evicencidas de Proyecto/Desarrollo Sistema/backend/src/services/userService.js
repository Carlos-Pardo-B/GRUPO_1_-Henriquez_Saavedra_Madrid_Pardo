import { query } from '../config/db.js';
import { hashPassword, comparePassword } from '../utils/password.js';

export async function findUserByEmail(email) {
  const res = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return res.rows[0] || null;
}

export async function createUser({ email, password, name, user_type = 'PUBLIC', is_superadmin = false }) {
  const password_hash = await hashPassword(password);
  const res = await query(
    `INSERT INTO users (email, password_hash, name, user_type, is_superadmin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, user_type, is_superadmin, created_at`,
    [email, password_hash, name, user_type, is_superadmin]
  );
  return res.rows[0];
}

export async function validateUserCredentials(email, password) {
  const res = await query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  const user = res.rows[0];
  if (!user) return null;

  const match = await comparePassword(password, user.password_hash);
  if (!match) return null;

  return user;
}

export async function findUserById(userId) {
  const res = await query(
    `SELECT id, email, name, user_type, is_superadmin
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return res.rows[0] || null;
}
