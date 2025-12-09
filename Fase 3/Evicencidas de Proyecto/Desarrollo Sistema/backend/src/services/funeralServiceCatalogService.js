import { pool } from '../config/db.js';

function httpError(status, error) {
  return { status, error };
}

export async function getServicesForOrganization(orgId) {
  const { rows } = await pool.query(
    `SELECT id, organization_id, code, name, description, base_price, category, is_active, created_at
     FROM funeral_services
     WHERE organization_id = $1
     ORDER BY created_at DESC, id DESC`,
    [orgId]
  );
  return rows;
}

export async function createServiceForOrganization(orgId, data = {}) {
  const { code = null, name, description = null, base_price, category, is_active = true } = data;
  if (!name) throw httpError(400, 'NAME_REQUIRED');
  if (!category) throw httpError(400, 'CATEGORY_REQUIRED');
  if (!Number.isInteger(Number(base_price))) throw httpError(400, 'BASE_PRICE_REQUIRED');

  try {
    const { rows } = await pool.query(
      `INSERT INTO funeral_services (organization_id, code, name, description, base_price, category, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, organization_id, code, name, description, base_price, category, is_active, created_at`,
      [orgId, code, name, description, Number(base_price), category, is_active]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'DUPLICATE_CODE');
    throw err;
  }
}

export async function updateService(orgId, serviceId, data = {}) {
  const sid = Number(serviceId);
  if (!Number.isInteger(sid)) throw httpError(400, 'INVALID_SERVICE_ID');

  const allowed = ['code', 'name', 'description', 'base_price', 'category', 'is_active'];
  const set = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      set.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx += 1;
    }
  }
  if (set.length === 0) throw httpError(400, 'NO_FIELDS');

  values.push(orgId, sid);
  try {
    const { rows } = await pool.query(
      `UPDATE funeral_services
       SET ${set.join(', ')}
       WHERE organization_id = $${idx} AND id = $${idx + 1}
       RETURNING id, organization_id, code, name, description, base_price, category, is_active, created_at`,
      values
    );
    if (!rows[0]) throw httpError(404, 'SERVICE_NOT_FOUND');
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'DUPLICATE_CODE');
    throw err;
  }
}

export async function deleteService(orgId, serviceId) {
  const sid = Number(serviceId);
  if (!Number.isInteger(sid)) throw httpError(400, 'INVALID_SERVICE_ID');
  const { rowCount } = await pool.query(
    `DELETE FROM funeral_services WHERE organization_id = $1 AND id = $2`,
    [orgId, sid]
  );
  if (rowCount === 0) throw httpError(404, 'SERVICE_NOT_FOUND');
  return { deleted: true };
}
