import { query } from '../config/db.js';

export async function getSitesByOrganization(organizationId) {
  const res = await query(
    `SELECT id, organization_id, code, name, description, region, comuna, address,
            latitude, longitude, status, created_at
     FROM cemetery_sites
     WHERE organization_id = $1
     ORDER BY name ASC, id ASC`,
    [organizationId]
  );
  return res.rows;
}

export async function getSiteById(siteId) {
  const res = await query(
    `SELECT id, organization_id, code, name, description, region, comuna, address,
            latitude, longitude, status, created_at
     FROM cemetery_sites
     WHERE id = $1`,
    [siteId]
  );
  return res.rows[0] || null;
}

export async function getSiteForOrganization(organizationId, siteId) {
  const res = await query(
    `SELECT id, organization_id, code, name, description, region, comuna, address,
            latitude, longitude, status, created_at
     FROM cemetery_sites
     WHERE id = $1 AND organization_id = $2`,
    [siteId, organizationId]
  );
  return res.rows[0] || null;
}

export async function createSiteForOrganization(organizationId, data) {
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
    `INSERT INTO cemetery_sites (
        organization_id, code, name, description, region, comuna, address,
        latitude, longitude, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, organization_id, code, name, description, region, comuna, address,
               latitude, longitude, status, created_at`,
    [
      organizationId,
      code,
      name,
      description,
      region,
      comuna,
      address,
      latitude,
      longitude,
      status
    ]
  );
  return res.rows[0];
}

export async function updateSite(siteId, data) {
  const allowed = [
    'code', 'name', 'description', 'region', 'comuna', 'address', 'latitude', 'longitude', 'status'
  ];
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
    return getSiteById(siteId);
  }
  values.push(siteId);
  const res = await query(
    `UPDATE cemetery_sites SET ${set.join(', ')} WHERE id = $${idx}
     RETURNING id, organization_id, code, name, description, region, comuna, address,
               latitude, longitude, status, created_at`,
    values
  );
  return res.rows[0] || null;
}

