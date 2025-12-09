import { pool } from '../config/db.js';
import { ensureSpaceInSite, setSpaceStatusWithinTx } from './cemeterySpacesService.js';

function httpError(status, error) {
  return { status, error };
}

async function assertCemeteryOrg(orgId) {
  const res = await pool.query(
    `SELECT id, type FROM organizations WHERE id = $1`,
    [orgId]
  );
  if (res.rowCount === 0) throw httpError(404, 'CEMETERY_ORG_NOT_FOUND');
  if (res.rows[0].type !== 'CEMENTERIO') throw httpError(400, 'INVALID_CEMETERY_ORG');
  return res.rows[0];
}

async function assertCemeterySite(orgId, siteId) {
  const res = await pool.query(
    `SELECT id, name, organization_id FROM cemetery_sites WHERE id = $1 AND organization_id = $2`,
    [siteId, orgId]
  );
  if (res.rowCount === 0) throw httpError(404, 'CEMETERY_SITE_NOT_FOUND');
  return res.rows[0];
}

async function assertPlotBelongsToSite(plotId, siteId) {
  const res = await pool.query(
    `SELECT p.id
     FROM cemetery_plots p
     JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE p.id = $1 AND a.site_id = $2`,
    [plotId, siteId]
  );
  if (res.rowCount === 0) throw httpError(404, 'PLOT_NOT_FOUND');
  return res.rows[0];
}

export async function createBurialRequest(funeralOrgId, data = {}) {
  const {
    cemetery_org_id,
    cemetery_site_id,
    deceased_full_name,
    date_of_death,
    requested_plot_type_id = null,
    requested_date = null,
    notes = null
  } = data;

  if (!deceased_full_name) throw httpError(400, 'DECEASED_NAME_REQUIRED');
  if (!date_of_death) throw httpError(400, 'DATE_OF_DEATH_REQUIRED');
  if (!cemetery_org_id) throw httpError(400, 'CEMETERY_REQUIRED');
  if (!cemetery_site_id) throw httpError(400, 'CEMETERY_SITE_REQUIRED');

  const cemeteryOrgId = Number(cemetery_org_id);
  const cemeterySiteId = Number(cemetery_site_id);
  if (!Number.isInteger(cemeteryOrgId) || !Number.isInteger(cemeterySiteId)) {
    throw httpError(400, 'INVALID_CEMETERY');
  }

  await assertCemeteryOrg(cemeteryOrgId);
  await assertCemeterySite(cemeteryOrgId, cemeterySiteId);

  const { rows } = await pool.query(
    `INSERT INTO burial_requests (
       funeral_org_id, cemetery_org_id, cemetery_site_id,
       deceased_full_name, date_of_death, requested_plot_type_id, requested_date,
       status, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
     RETURNING id, funeral_org_id, cemetery_org_id, cemetery_site_id, deceased_full_name,
               date_of_death, requested_plot_type_id, requested_date, status,
               assigned_plot_id, assigned_space_id, notes, created_at`,
    [
      funeralOrgId,
      cemeteryOrgId,
      cemeterySiteId,
      deceased_full_name,
      date_of_death,
      requested_plot_type_id || null,
      requested_date || null,
      notes || null
    ]
  );
  return rows[0];
}

export async function getBurialRequestsForFuneralOrg(funeralOrgId) {
  const { rows } = await pool.query(
    `SELECT br.id, br.funeral_org_id, br.cemetery_org_id, br.cemetery_site_id,
            br.deceased_full_name, br.date_of_death, br.requested_plot_type_id,
            br.requested_date, br.status, br.assigned_plot_id, br.assigned_space_id,
            br.notes, br.created_at,
            co.name AS cemetery_name, cs.name AS cemetery_site_name
     FROM burial_requests br
     JOIN organizations co ON co.id = br.cemetery_org_id
     LEFT JOIN cemetery_sites cs ON cs.id = br.cemetery_site_id
     WHERE br.funeral_org_id = $1
     ORDER BY br.created_at DESC`,
    [funeralOrgId]
  );
  return rows;
}

export async function getBurialRequestsForCemeteryOrg(cemeteryOrgId, siteId = null) {
  const params = [cemeteryOrgId];
  let siteClause = '';
  if (siteId) {
    params.push(siteId);
    siteClause = ' AND br.cemetery_site_id = $2';
  }
  const { rows } = await pool.query(
    `SELECT br.id, br.funeral_org_id, br.cemetery_org_id, br.cemetery_site_id,
            br.deceased_full_name, br.date_of_death, br.requested_plot_type_id,
            br.requested_date, br.status, br.assigned_plot_id, br.assigned_space_id,
            br.notes, br.created_at,
            fo.name AS funeral_name,
            cs.name AS cemetery_site_name
     FROM burial_requests br
     JOIN organizations fo ON fo.id = br.funeral_org_id
     LEFT JOIN cemetery_sites cs ON cs.id = br.cemetery_site_id
     WHERE br.cemetery_org_id = $1${siteClause}
     ORDER BY br.created_at DESC`,
    params
  );
  return rows;
}

async function findBurialRequestForCemetery(cemeteryOrgId, id) {
  const { rows } = await pool.query(
    `SELECT * FROM burial_requests WHERE id = $1 AND cemetery_org_id = $2`,
    [id, cemeteryOrgId]
  );
  return rows[0] || null;
}

export async function approveBurialRequest(cemeteryOrgId, id) {
  const rid = Number(id);
  if (!Number.isInteger(rid)) throw httpError(400, 'INVALID_REQUEST_ID');
  const req = await findBurialRequestForCemetery(cemeteryOrgId, rid);
  if (!req) throw httpError(404, 'REQUEST_NOT_FOUND');
  const { rows } = await pool.query(
    `UPDATE burial_requests
     SET status = 'APPROVED'
     WHERE id = $1
     RETURNING *`,
    [rid]
  );
  return rows[0];
}

export async function rejectBurialRequest(cemeteryOrgId, id, reason = null) {
  const rid = Number(id);
  if (!Number.isInteger(rid)) throw httpError(400, 'INVALID_REQUEST_ID');
  const req = await findBurialRequestForCemetery(cemeteryOrgId, rid);
  if (!req) throw httpError(404, 'REQUEST_NOT_FOUND');
  const { rows } = await pool.query(
    `UPDATE burial_requests
     SET status = 'REJECTED', notes = COALESCE($2, notes)
     WHERE id = $1
     RETURNING *`,
    [rid, reason || null]
  );
  return rows[0];
}

export async function assignPlotToBurialRequest(cemeteryOrgId, siteId, id, plotId, spaceId) {
  const rid = Number(id);
  const pid = Number(plotId);
  const sid = Number(spaceId);
  const site = Number(siteId);
  if (!Number.isInteger(rid) || !Number.isInteger(pid) || !Number.isInteger(sid) || !Number.isInteger(site)) {
    throw httpError(400, 'INVALID_IDS');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reqRes = await client.query(
      `SELECT * FROM burial_requests WHERE id = $1 AND cemetery_org_id = $2`,
      [rid, cemeteryOrgId]
    );
    if (reqRes.rowCount === 0) throw httpError(404, 'REQUEST_NOT_FOUND');
    const request = reqRes.rows[0];
    if (request.cemetery_site_id !== site) throw httpError(400, 'SITE_MISMATCH');

    await assertPlotBelongsToSite(pid, site);
    const space = await ensureSpaceInSite(client, site, sid, pid);
    if (!space) throw httpError(404, 'SPACE_NOT_FOUND');
    if (space.status === 'OCCUPIED') throw httpError(409, 'SPACE_OCCUPIED');
    if (space.status === 'LOCKED') throw httpError(409, 'SPACE_LOCKED');

    await client.query(
      `UPDATE burial_requests
       SET assigned_plot_id = $1, assigned_space_id = $2, status = 'ASSIGNED'
       WHERE id = $3`,
      [pid, sid, rid]
    );

    await setSpaceStatusWithinTx(client, sid, 'OCCUPIED');

    await client.query('COMMIT');
    return { assigned: true };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) throw err;
    throw err;
  } finally {
    client.release();
  }
}
