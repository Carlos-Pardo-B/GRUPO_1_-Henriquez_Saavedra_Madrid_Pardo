import { pool } from '../config/db.js';

function asHttpError(status, error, extra = {}) {
  return { status, error, ...extra };
}

export async function getAreasBySite(siteId) {
  const q = `
    SELECT id, site_id, code, name, description, is_active, created_at
    FROM cemetery_areas
    WHERE site_id = $1
    ORDER BY name ASC, id ASC`;
  const { rows } = await pool.query(q, [siteId]);
  return rows;
}

export async function createArea(siteId, data) {
  const { code, name, description } = data || {};
  if (!name) throw asHttpError(400, 'AREA_NAME_REQUIRED');
  const q = `
    INSERT INTO cemetery_areas (site_id, code, name, description)
    VALUES ($1, $2, $3, $4)
    RETURNING id, site_id, code, name, description, is_active, created_at`;
  const values = [siteId, code || null, name, description || null];
  const { rows } = await pool.query(q, values);
  return rows[0];
}

export async function getSectorsByArea(siteId, areaId) {
  // Validate area belongs to site
  const areaRes = await pool.query(
    'SELECT id FROM cemetery_areas WHERE id = $1 AND site_id = $2',
    [areaId, siteId]
  );
  if (areaRes.rowCount === 0) throw asHttpError(404, 'AREA_NOT_FOUND');

  const q = `
    SELECT id, area_id, code, name, description, is_active, created_at
    FROM cemetery_sectors
    WHERE area_id = $1
    ORDER BY name ASC, id ASC`;
  const { rows } = await pool.query(q, [areaId]);
  return rows;
}

export async function createSector(siteId, areaId, data) {
  const { code, name, description } = data || {};
  if (!name) throw asHttpError(400, 'SECTOR_NAME_REQUIRED');

  const areaRes = await pool.query(
    'SELECT id FROM cemetery_areas WHERE id = $1 AND site_id = $2',
    [areaId, siteId]
  );
  if (areaRes.rowCount === 0) throw asHttpError(404, 'AREA_NOT_FOUND');

  const q = `
    INSERT INTO cemetery_sectors (area_id, code, name, description)
    VALUES ($1, $2, $3, $4)
    RETURNING id, area_id, code, name, description, is_active, created_at`;
  const values = [areaId, code || null, name, description || null];
  const { rows } = await pool.query(q, values);
  return rows[0];
}

export async function getSubsectorsBySector(siteId, sectorId) {
  // Validate sector belongs to site via area -> site
  const sectorRes = await pool.query(
    `SELECT s.id
     FROM cemetery_sectors s
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE s.id = $1 AND a.site_id = $2`,
    [sectorId, siteId]
  );
  if (sectorRes.rowCount === 0) throw asHttpError(404, 'SECTOR_NOT_FOUND');

  const q = `
    SELECT id, sector_id, code, name, description, is_active, created_at
    FROM cemetery_subsectors
    WHERE sector_id = $1
    ORDER BY name ASC, id ASC`;
  const { rows } = await pool.query(q, [sectorId]);
  return rows;
}

export async function createSubsector(siteId, sectorId, data) {
  const { code, name, description } = data || {};
  if (!name) throw asHttpError(400, 'SUBSECTOR_NAME_REQUIRED');

  const sectorRes = await pool.query(
    `SELECT s.id
     FROM cemetery_sectors s
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE s.id = $1 AND a.site_id = $2`,
    [sectorId, siteId]
  );
  if (sectorRes.rowCount === 0) throw asHttpError(404, 'SECTOR_NOT_FOUND');

  const q = `
    INSERT INTO cemetery_subsectors (sector_id, code, name, description)
    VALUES ($1, $2, $3, $4)
    RETURNING id, sector_id, code, name, description, is_active, created_at`;
  const values = [sectorId, code || null, name, description || null];
  const { rows } = await pool.query(q, values);
  return rows[0];
}

export async function deleteArea(siteId, areaId) {
  const check = await pool.query(
    'SELECT id FROM cemetery_areas WHERE id = $1 AND site_id = $2',
    [areaId, siteId]
  );
  if (check.rowCount === 0) throw asHttpError(404, 'AREA_NOT_FOUND');
  await pool.query('DELETE FROM cemetery_areas WHERE id = $1', [areaId]);
  return { deleted: true };
}

export async function deleteSector(siteId, sectorId) {
  const check = await pool.query(
    `SELECT s.id
     FROM cemetery_sectors s
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE s.id = $1 AND a.site_id = $2`,
    [sectorId, siteId]
  );
  if (check.rowCount === 0) throw asHttpError(404, 'SECTOR_NOT_FOUND');
  await pool.query('DELETE FROM cemetery_sectors WHERE id = $1', [sectorId]);
  return { deleted: true };
}

export async function deleteSubsector(siteId, subsectorId) {
  const check = await pool.query(
    `SELECT ss.id
     FROM cemetery_subsectors ss
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE ss.id = $1 AND a.site_id = $2`,
    [subsectorId, siteId]
  );
  if (check.rowCount === 0) throw asHttpError(404, 'SUBSECTOR_NOT_FOUND');
  await pool.query('DELETE FROM cemetery_subsectors WHERE id = $1', [subsectorId]);
  return { deleted: true };
}

export async function updateArea(siteId, areaId, data) {
  const allowed = ['code', 'name', 'description', 'is_active'];
  const fields = [];
  const values = [];
  let idx = 1;

  // Validate belongs to site
  const areaCheck = await pool.query(
    'SELECT id FROM cemetery_areas WHERE id = $1 AND site_id = $2',
    [areaId, siteId]
  );
  if (areaCheck.rowCount === 0) throw asHttpError(404, 'AREA_NOT_FOUND');

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
      fields.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx += 1;
    }
  }
  if (fields.length === 0) {
    const { rows } = await pool.query(
      'SELECT id, site_id, code, name, description, is_active, created_at FROM cemetery_areas WHERE id = $1',
      [areaId]
    );
    return rows[0];
  }
  values.push(areaId);
  try {
    const { rows } = await pool.query(
      `UPDATE cemetery_areas SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, site_id, code, name, description, is_active, created_at`,
      values
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '23505') throw asHttpError(409, 'DUPLICATE');
    throw err;
  }
}

export async function updateSector(siteId, sectorId, data) {
  const allowed = ['code', 'name', 'description', 'is_active'];
  const fields = [];
  const values = [];
  let idx = 1;

  // Validate sector belongs to site via area
  const secCheck = await pool.query(
    `SELECT s.id
     FROM cemetery_sectors s
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE s.id = $1 AND a.site_id = $2`,
    [sectorId, siteId]
  );
  if (secCheck.rowCount === 0) throw asHttpError(404, 'SECTOR_NOT_FOUND');

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
      fields.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx += 1;
    }
  }
  if (fields.length === 0) {
    const { rows } = await pool.query(
      'SELECT id, area_id, code, name, description, is_active, created_at FROM cemetery_sectors WHERE id = $1',
      [sectorId]
    );
    return rows[0];
  }
  values.push(sectorId);
  try {
    const { rows } = await pool.query(
      `UPDATE cemetery_sectors SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, area_id, code, name, description, is_active, created_at`,
      values
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '23505') throw asHttpError(409, 'DUPLICATE');
    throw err;
  }
}

export async function updateSubsector(siteId, subsectorId, data) {
  const allowed = ['code', 'name', 'description', 'is_active'];
  const fields = [];
  const values = [];
  let idx = 1;

  // Validate subsector belongs to site via sector -> area -> site
  const subCheck = await pool.query(
    `SELECT ss.id
     FROM cemetery_subsectors ss
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE ss.id = $1 AND a.site_id = $2`,
    [subsectorId, siteId]
  );
  if (subCheck.rowCount === 0) throw asHttpError(404, 'SUBSECTOR_NOT_FOUND');

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
      fields.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx += 1;
    }
  }
  if (fields.length === 0) {
    const { rows } = await pool.query(
      'SELECT id, sector_id, code, name, description, is_active, created_at FROM cemetery_subsectors WHERE id = $1',
      [subsectorId]
    );
    return rows[0];
  }
  values.push(subsectorId);
  try {
    const { rows } = await pool.query(
      `UPDATE cemetery_subsectors SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, sector_id, code, name, description, is_active, created_at`,
      values
    );
    return rows[0] || null;
  } catch (err) {
    if (err.code === '23505') throw asHttpError(409, 'DUPLICATE');
    throw err;
  }
}
