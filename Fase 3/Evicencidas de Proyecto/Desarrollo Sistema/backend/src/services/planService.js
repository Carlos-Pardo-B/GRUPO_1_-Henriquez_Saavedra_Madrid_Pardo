import { query } from '../config/db.js';

const updatablePlanFields = [
  'code',
  'name',
  'description',
  'price_monthly_cents',
  'price_yearly_cents',
  'max_users',
  'max_memorials',
  'max_requests_per_month',
  'features',
  'is_active'
];

export async function getAllPlans({ includeInactive = false } = {}) {
  const res = await query(
    `SELECT *
     FROM plans
     ${includeInactive ? '' : 'WHERE is_active = true'}
     ORDER BY price_monthly_cents ASC, id ASC`
  );
  return res.rows;
}

export async function getPlanById(id) {
  const res = await query('SELECT * FROM plans WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function createPlan(data) {
  const plan = {
    code: data.code?.trim().toUpperCase(),
    name: data.name,
    description: data.description ?? null,
    price_monthly_cents: data.price_monthly_cents ?? 0,
    price_yearly_cents: data.price_yearly_cents ?? 0,
    max_users: data.max_users ?? null,
    max_memorials: data.max_memorials ?? null,
    max_requests_per_month: data.max_requests_per_month ?? null,
    features: data.features ?? {}
  };

  const res = await query(
    `INSERT INTO plans (
        code, name, description, price_monthly_cents, price_yearly_cents,
        max_users, max_memorials, max_requests_per_month, features
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      plan.code,
      plan.name,
      plan.description,
      plan.price_monthly_cents,
      plan.price_yearly_cents,
      plan.max_users,
      plan.max_memorials,
      plan.max_requests_per_month,
      plan.features
    ]
  );

  return res.rows[0];
}

export async function updatePlan(id, data) {
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const field of updatablePlanFields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${idx}`);
      if (field === 'code' && typeof data[field] === 'string') {
        values.push(data[field].trim().toUpperCase());
      } else {
        values.push(data[field]);
      }
      idx += 1;
    }
  }

  if (setClauses.length === 0) {
    return getPlanById(id);
  }

  values.push(id);

  const res = await query(
    `UPDATE plans
     SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
    values
  );

  return res.rows[0] || null;
}

export async function setPlanActive(id, isActive) {
  const res = await query(
    'UPDATE plans SET is_active = $1 WHERE id = $2 RETURNING *',
    [isActive, id]
  );
  return res.rows[0] || null;
}
