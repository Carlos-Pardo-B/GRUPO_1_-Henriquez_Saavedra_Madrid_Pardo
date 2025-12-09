import { pool } from '../config/db.js';

function httpError(status, error, extra = {}) {
  return { status, error, ...extra };
}

export const allowedSpaceStatuses = new Set(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'LOCKED']);

async function getSpaceWithSite(client, siteId, spaceId) {
  const res = await client.query(
    `SELECT sp.id, sp.plot_id, sp.position, sp.status, sp.notes, sp.created_at
     FROM cemetery_spaces sp
     JOIN cemetery_plots p ON p.id = sp.plot_id
     JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE sp.id = $1 AND a.site_id = $2`,
    [spaceId, siteId]
  );
  return res.rows[0] || null;
}

export async function getSpacesByPlot(siteId, plotId) {
  const pid = Number(plotId);
  if (!Number.isInteger(pid)) throw httpError(400, 'INVALID_PLOT_ID');

  const client = await pool.connect();
  try {
    const plotCheck = await client.query(
      `SELECT p.id
       FROM cemetery_plots p
       JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
       JOIN cemetery_sectors s ON s.id = ss.sector_id
       JOIN cemetery_areas a ON a.id = s.area_id
       WHERE p.id = $1 AND a.site_id = $2`,
      [pid, siteId]
    );
    if (plotCheck.rowCount === 0) throw httpError(404, 'PLOT_NOT_FOUND');

    const { rows } = await client.query(
      `SELECT id, plot_id, position, status, notes, created_at
       FROM cemetery_spaces
       WHERE plot_id = $1
       ORDER BY position ASC`,
      [pid]
    );
    return rows;
  } catch (err) {
    if (err.status) throw err;
    console.error('getSpacesByPlot error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}

export async function updateSpaceStatus(siteId, spaceId, payload = {}) {
  const sid = Number(spaceId);
  if (!Number.isInteger(sid)) throw httpError(400, 'INVALID_SPACE_ID');
  const { status, notes } = payload;
  if (!status || !allowedSpaceStatuses.has(status)) {
    throw httpError(400, 'INVALID_STATUS');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const space = await getSpaceWithSite(client, siteId, sid);
    if (!space) throw httpError(404, 'SPACE_NOT_FOUND');

    const fields = ['status = $1'];
    const values = [status];
    let idx = 2;
    if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
      fields.push(`notes = $${idx}`);
      values.push(notes ?? null);
      idx += 1;
    }
    values.push(sid);

    const { rows } = await client.query(
      `UPDATE cemetery_spaces
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, plot_id, position, status, notes, created_at`,
      values
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) throw err;
    console.error('updateSpaceStatus error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}

export async function ensureSpaceInSite(client, siteId, spaceId, plotId = null) {
  const sid = Number(spaceId);
  if (!Number.isInteger(sid)) throw httpError(400, 'INVALID_SPACE_ID');
  const params = [sid, siteId];
  let plotClause = '';
  if (plotId !== null) {
    params.push(plotId);
    plotClause = ` AND p.id = $3`;
  }

  const res = await client.query(
    `SELECT sp.id, sp.plot_id, sp.position, sp.status
     FROM cemetery_spaces sp
     JOIN cemetery_plots p ON p.id = sp.plot_id
     JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE sp.id = $1 AND a.site_id = $2${plotClause}`,
    params
  );
  return res.rows[0] || null;
}

export async function setSpaceStatusWithinTx(client, spaceId, status, notes = null) {
  if (!allowedSpaceStatuses.has(status)) throw httpError(400, 'INVALID_STATUS');
  const values = [status, notes ?? null, spaceId];
  await client.query(
    `UPDATE cemetery_spaces
     SET status = $1, notes = COALESCE($2, notes)
     WHERE id = $3`,
    values
  );
}
