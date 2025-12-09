import { pool } from '../config/db.js';
import { ensureSpaceInSite, setSpaceStatusWithinTx } from './cemeterySpacesService.js';

function httpError(status, error, extra = {}) {
  return { status, error, ...extra };
}

async function validatePlotBelongsToSite(client, siteId, plotId) {
  const res = await client.query(
    `SELECT p.id
     FROM cemetery_plots p
     JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE p.id = $1 AND a.site_id = $2`,
    [plotId, siteId]
  );
  return res.rowCount > 0;
}

export async function createDeceasedRecord(orgId, siteId, data = {}) {
  const {
    full_name,
    rut = null,
    date_of_birth = null,
    date_of_death,
    notes = null,
    plot_id,
    space_id = null
  } = data;

  if (!full_name || !full_name.trim()) throw httpError(400, 'FULL_NAME_REQUIRED');
  if (!date_of_death) throw httpError(400, 'DATE_OF_DEATH_REQUIRED');
  const plotId = Number(plot_id);
  if (!Number.isInteger(plotId)) throw httpError(400, 'INVALID_PLOT_ID');
  const spaceId = space_id !== null && space_id !== undefined ? Number(space_id) : null;
  if (spaceId !== null && !Number.isInteger(spaceId)) throw httpError(400, 'INVALID_SPACE_ID');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const plotOk = await validatePlotBelongsToSite(client, siteId, plotId);
    if (!plotOk) throw httpError(404, 'PLOT_NOT_FOUND');

    if (spaceId !== null) {
      const space = await ensureSpaceInSite(client, siteId, spaceId, plotId);
      if (!space) throw httpError(404, 'SPACE_NOT_FOUND');
      if (space.status === 'LOCKED') throw httpError(409, 'SPACE_LOCKED');
      if (space.status === 'OCCUPIED') throw httpError(409, 'SPACE_OCCUPIED');
    }

    const { rows } = await client.query(
      `INSERT INTO deceased_records (
         full_name, rut, date_of_birth, date_of_death, notes,
         plot_id, space_id, organization_id, site_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, full_name, rut, date_of_birth, date_of_death, notes,
                 plot_id, space_id, organization_id, site_id, created_at`,
      [
        full_name.trim(),
        rut || null,
        date_of_birth || null,
        date_of_death,
        notes || null,
        plotId,
        spaceId,
        orgId,
        siteId
      ]
    );
    const record = rows[0];

    if (spaceId !== null) {
      await setSpaceStatusWithinTx(client, spaceId, 'OCCUPIED');
    }

    await client.query('COMMIT');
    return record;
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) throw err;
    console.error('createDeceasedRecord error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}

export async function listDeceasedRecords(orgId, siteId) {
  const q = `
    SELECT dr.id, dr.full_name, dr.rut, dr.date_of_birth, dr.date_of_death, dr.notes,
           dr.plot_id, dr.space_id, dr.organization_id, dr.site_id, dr.created_at,
           cp.code AS plot_code, cs.status AS space_status, cs.position AS space_position,
           a.name AS area_name, s.name AS sector_name, ss.name AS subsector_name
    FROM deceased_records dr
    JOIN cemetery_plots cp ON cp.id = dr.plot_id
    JOIN cemetery_subsectors ss ON ss.id = cp.subsector_id
    JOIN cemetery_sectors s ON s.id = ss.sector_id
    JOIN cemetery_areas a ON a.id = s.area_id
    LEFT JOIN cemetery_spaces cs ON cs.id = dr.space_id
    WHERE dr.organization_id = $1 AND dr.site_id = $2
    ORDER BY dr.date_of_death DESC, dr.id DESC`;
  try {
    const { rows } = await pool.query(q, [orgId, siteId]);
    return rows;
  } catch (err) {
    console.error('listDeceasedRecords error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  }
}

export async function getDeceasedRecordById(orgId, siteId, recordId) {
  const rid = Number(recordId);
  if (!Number.isInteger(rid)) throw httpError(400, 'INVALID_DECEASED_ID');
  const q = `
    SELECT dr.id, dr.full_name, dr.rut, dr.date_of_birth, dr.date_of_death, dr.notes,
           dr.plot_id, dr.space_id, dr.organization_id, dr.site_id, dr.created_at,
           cp.code AS plot_code, cs.status AS space_status, cs.position AS space_position,
           a.name AS area_name, s.name AS sector_name, ss.name AS subsector_name
    FROM deceased_records dr
    JOIN cemetery_plots cp ON cp.id = dr.plot_id
    JOIN cemetery_subsectors ss ON ss.id = cp.subsector_id
    JOIN cemetery_sectors s ON s.id = ss.sector_id
    JOIN cemetery_areas a ON a.id = s.area_id
    LEFT JOIN cemetery_spaces cs ON cs.id = dr.space_id
    WHERE dr.organization_id = $1 AND dr.site_id = $2 AND dr.id = $3`;
  try {
    const { rows } = await pool.query(q, [orgId, siteId, rid]);
    return rows[0] || null;
  } catch (err) {
    console.error('getDeceasedRecordById error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  }
}

export async function deleteDeceasedRecord(orgId, siteId, recordId) {
  const rid = Number(recordId);
  if (!Number.isInteger(rid)) throw httpError(400, 'INVALID_DECEASED_ID');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows, rowCount } = await client.query(
      `SELECT id, space_id
       FROM deceased_records
       WHERE id = $1 AND organization_id = $2 AND site_id = $3`,
      [rid, orgId, siteId]
    );
    if (rowCount === 0) throw httpError(404, 'DECEASED_NOT_FOUND');
    const record = rows[0];

    await client.query('DELETE FROM deceased_records WHERE id = $1', [rid]);

    if (record.space_id) {
      await setSpaceStatusWithinTx(client, record.space_id, 'AVAILABLE');
    }

    await client.query('COMMIT');
    return { deleted: true };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) throw err;
    console.error('deleteDeceasedRecord error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}

export async function publicSearchDeceased(searchTerm) {
  const term = (searchTerm || '').trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const q = `
    SELECT dr.id, dr.full_name, dr.date_of_death,
           org.name AS cemetery_name, site.name AS site_name,
           a.name AS area_name, sec.name AS sector_name,
           ss.name AS subsector_name, cp.code AS plot_code
    FROM deceased_records dr
    JOIN organizations org ON org.id = dr.organization_id
    JOIN cemetery_sites site ON site.id = dr.site_id
    JOIN cemetery_plots cp ON cp.id = dr.plot_id
    JOIN cemetery_subsectors ss ON ss.id = cp.subsector_id
    JOIN cemetery_sectors sec ON sec.id = ss.sector_id
    JOIN cemetery_areas a ON a.id = sec.area_id
    WHERE dr.full_name ILIKE $1 OR dr.rut ILIKE $1
    ORDER BY dr.date_of_death DESC, dr.full_name ASC
    LIMIT 50`;
  try {
    const { rows } = await pool.query(q, [like]);
    return rows;
  } catch (err) {
    console.error('publicSearchDeceased error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  }
}
