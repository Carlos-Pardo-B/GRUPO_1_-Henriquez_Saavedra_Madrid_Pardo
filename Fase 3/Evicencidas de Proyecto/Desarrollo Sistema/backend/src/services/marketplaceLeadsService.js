import { pool } from '../config/db.js';

const STATUSES = ['NEW', 'VIEWED', 'CONTACTED', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CANCELED'];

export async function createMarketplaceLead(userId, payload = {}) {
  const { product_id, deceased_id = null, memorial_id = null, preferred_date = null, quantity = null, notes = null } = payload;
  if (!product_id) {
    const err = new Error('PRODUCT_REQUIRED');
    err.httpStatus = 400;
    throw err;
  }
  const prodRes = await pool.query(`SELECT id, organization_id FROM marketplace_products WHERE id = $1 AND is_active = true`, [product_id]);
  const product = prodRes.rows[0];
  if (!product) {
    const err = new Error('PRODUCT_NOT_FOUND');
    err.httpStatus = 404;
    throw err;
  }
  const { rows } = await pool.query(
    `INSERT INTO marketplace_leads (product_id, organization_id, user_id, deceased_id, memorial_id, preferred_date, quantity, notes, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'NEW')
     RETURNING *`,
    [product_id, product.organization_id, userId, deceased_id, memorial_id, preferred_date, quantity, notes]
  );
  return rows[0];
}

export async function getLeadsForOrganization(orgId) {
  const { rows } = await pool.query(
    `SELECT ml.*, mp.name as product_name, mp.category, u.email as user_email
     FROM marketplace_leads ml
     JOIN marketplace_products mp ON mp.id = ml.product_id
     JOIN users u ON u.id = ml.user_id
     WHERE ml.organization_id = $1
     ORDER BY ml.created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function updateLeadStatusForOrganization(orgId, leadId, status) {
  if (!STATUSES.includes(status)) {
    const err = new Error('INVALID_STATUS');
    err.httpStatus = 400;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE marketplace_leads
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3
     RETURNING *`,
    [status, leadId, orgId]
  );
  if (!rows[0]) {
    const err = new Error('NOT_FOUND');
    err.httpStatus = 404;
    throw err;
  }
  return rows[0];
}

export async function getLeadsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT ml.*, mp.name as product_name, mp.category, o.name as organization_name
     FROM marketplace_leads ml
     JOIN marketplace_products mp ON mp.id = ml.product_id
     JOIN organizations o ON o.id = ml.organization_id
     WHERE ml.user_id = $1
     ORDER BY ml.created_at DESC`,
    [userId]
  );
  return rows;
}
