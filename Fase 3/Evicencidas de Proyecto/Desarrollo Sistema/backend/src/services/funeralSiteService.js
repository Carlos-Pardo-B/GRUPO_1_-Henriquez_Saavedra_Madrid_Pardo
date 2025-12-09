import { query } from '../config/db.js';

export async function getFuneralSitesByOrganization(organizationId) {
  const res = await query(
    `SELECT id, organization_id, code, name, description, region, comuna, address,
            latitude, longitude, status, created_at
     FROM funeral_sites
     WHERE organization_id = $1
     ORDER BY name ASC, id ASC`,
    [organizationId]
  );
  return res.rows;
}

export async function getFuneralSiteForOrganization(organizationId, siteId) {
  const res = await query(
    `SELECT id, organization_id, code, name, description, region, comuna, address,
            latitude, longitude, status, created_at
     FROM funeral_sites
     WHERE organization_id = $1 AND id = $2`,
    [organizationId, siteId]
  );
  return res.rows[0] || null;
}

export async function createFuneralSite(organizationId, data = {}) {
  const {
    code = null,
    name,
    description = null,
    region = null,
    comuna = null,
    address = null,
    latitude = null,
    longitude = null,
    status = 'ACTIVE'
  } = data;

  if (!name) {
    const err = new Error('NAME_REQUIRED');
    err.httpStatus = 400;
    throw err;
  }

  const res = await query(
    `INSERT INTO funeral_sites (
        organization_id, code, name, description, region, comuna, address,
        latitude, longitude, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, organization_id, code, name, description, region, comuna, address,
               latitude, longitude, status, created_at`,
    [organizationId, code, name, description, region, comuna, address, latitude, longitude, status]
  );
  return res.rows[0];
}

export async function updateFuneralSite(organizationId, siteId, data = {}) {
  const allowed = ['code', 'name', 'description', 'region', 'comuna', 'address', 'latitude', 'longitude', 'status'];
  const set = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in data) {
      set.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx += 1;
    }
  }
  if (set.length === 0) {
    return getFuneralSiteForOrganization(organizationId, siteId);
  }
  values.push(organizationId, siteId);
  const res = await query(
    `UPDATE funeral_sites
     SET ${set.join(', ')}
     WHERE organization_id = $${idx} AND id = $${idx + 1}
     RETURNING id, organization_id, code, name, description, region, comuna, address,
               latitude, longitude, status, created_at`,
    values
  );
  return res.rows[0] || null;
}

export async function deleteFuneralSite(organizationId, siteId) {
  await query(`DELETE FROM funeral_sites WHERE organization_id = $1 AND id = $2`, [organizationId, siteId]);
  return true;
}
