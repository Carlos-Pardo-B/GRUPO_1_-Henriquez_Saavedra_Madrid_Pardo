import { pool } from '../config/db.js';

function httpError(status, error) {
  return { status, error };
}

export async function getPackagesForOrganization(orgId) {
  const { rows } = await pool.query(
    `SELECT id, organization_id, name, description, price, is_active, created_at
     FROM funeral_packages
     WHERE organization_id = $1
     ORDER BY created_at DESC, id DESC`,
    [orgId]
  );
  return rows;
}

export async function createPackageForOrganization(orgId, data = {}) {
  const { name, description = null, price, is_active = true } = data;
  if (!name) throw httpError(400, 'NAME_REQUIRED');
  if (!Number.isInteger(Number(price))) throw httpError(400, 'PRICE_REQUIRED');

  const { rows } = await pool.query(
    `INSERT INTO funeral_packages (organization_id, name, description, price, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, organization_id, name, description, price, is_active, created_at`,
    [orgId, name, description, Number(price), is_active]
  );
  return rows[0];
}

export async function updatePackage(orgId, packageId, data = {}) {
  const pid = Number(packageId);
  if (!Number.isInteger(pid)) throw httpError(400, 'INVALID_PACKAGE_ID');

  const allowed = ['name', 'description', 'price', 'is_active'];
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
  values.push(orgId, pid);

  const { rows } = await pool.query(
    `UPDATE funeral_packages
     SET ${set.join(', ')}
     WHERE organization_id = $${idx} AND id = $${idx + 1}
     RETURNING id, organization_id, name, description, price, is_active, created_at`,
    values
  );
  if (!rows[0]) throw httpError(404, 'PACKAGE_NOT_FOUND');
  return rows[0];
}

export async function deletePackage(orgId, packageId) {
  const pid = Number(packageId);
  if (!Number.isInteger(pid)) throw httpError(400, 'INVALID_PACKAGE_ID');
  const { rowCount } = await pool.query(
    `DELETE FROM funeral_packages WHERE organization_id = $1 AND id = $2`,
    [orgId, pid]
  );
  if (rowCount === 0) throw httpError(404, 'PACKAGE_NOT_FOUND');
  return { deleted: true };
}

export async function getPackageItems(orgId, packageId) {
  const pid = Number(packageId);
  if (!Number.isInteger(pid)) throw httpError(400, 'INVALID_PACKAGE_ID');
  const { rows } = await pool.query(
    `SELECT fpi.id, fpi.package_id, fpi.service_id, fpi.quantity, fpi.created_at,
            fs.name AS service_name, fs.category AS service_category, fs.base_price, fs.is_active AS service_active
     FROM funeral_package_items fpi
     JOIN funeral_packages fp ON fp.id = fpi.package_id
     JOIN funeral_services fs ON fs.id = fpi.service_id
     WHERE fp.organization_id = $1 AND fpi.package_id = $2
     ORDER BY fpi.id DESC`,
    [orgId, pid]
  );
  return rows;
}

export async function addItemToPackage(orgId, packageId, serviceId, quantity = 1) {
  const pid = Number(packageId);
  const sid = Number(serviceId);
  const qty = Number(quantity);
  if (!Number.isInteger(pid)) throw httpError(400, 'INVALID_PACKAGE_ID');
  if (!Number.isInteger(sid)) throw httpError(400, 'INVALID_SERVICE_ID');
  if (!Number.isInteger(qty) || qty <= 0) throw httpError(400, 'INVALID_QUANTITY');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkg = await client.query(
      `SELECT id, organization_id FROM funeral_packages WHERE id = $1 AND organization_id = $2`,
      [pid, orgId]
    );
    if (pkg.rowCount === 0) throw httpError(404, 'PACKAGE_NOT_FOUND');

    const svc = await client.query(
      `SELECT id, organization_id FROM funeral_services WHERE id = $1 AND organization_id = $2`,
      [sid, orgId]
    );
    if (svc.rowCount === 0) throw httpError(404, 'SERVICE_NOT_FOUND');

    const { rows } = await client.query(
      `INSERT INTO funeral_package_items (package_id, service_id, quantity)
       VALUES ($1, $2, $3)
       RETURNING id, package_id, service_id, quantity, created_at`,
      [pid, sid, qty]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) throw err;
    throw err;
  } finally {
    client.release();
  }
}

export async function removeItemFromPackage(orgId, itemId) {
  const iid = Number(itemId);
  if (!Number.isInteger(iid)) throw httpError(400, 'INVALID_ITEM_ID');
  const { rowCount } = await pool.query(
    `DELETE FROM funeral_package_items
     WHERE id = $1 AND package_id IN (SELECT id FROM funeral_packages WHERE organization_id = $2)`,
    [iid, orgId]
  );
  if (rowCount === 0) throw httpError(404, 'ITEM_NOT_FOUND');
  return { deleted: true };
}
