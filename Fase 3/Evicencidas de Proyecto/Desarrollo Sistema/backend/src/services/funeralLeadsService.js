import { pool } from '../config/db.js';

const FUNERAL_STATUSES = ['NEW', 'VIEWED', 'CONTACTED', 'QUOTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

export async function getFuneralLeadsForOrg(orgId) {
  const { rows } = await pool.query(
    `SELECT srf.id,
            srf.request_id,
            srf.status,
            srf.notes_for_funeral,
            srf.internal_notes,
            srf.created_at,
            sr.title as request_title,
            sr.service_type as request_service_type,
            sr.region as request_region,
            sr.comuna as request_comuna,
            sr.status as request_status,
            u.email as user_email,
            coalesce(eup.full_name, u.name) as user_full_name
     FROM service_request_funeral_options srf
     JOIN service_requests sr ON sr.id = srf.request_id
     JOIN users u ON u.id = sr.user_id
     LEFT JOIN end_user_profiles eup ON eup.user_id = u.id
     WHERE srf.funeral_org_id = $1
     ORDER BY srf.created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function getFuneralLeadDetail(orgId, optionId) {
  const { rows } = await pool.query(
    `SELECT srf.*,
            sr.title as request_title,
            sr.service_type as request_service_type,
            sr.region as request_region,
            sr.comuna as request_comuna,
            sr.description as request_description,
            sr.status as request_status,
            u.email as user_email,
            coalesce(eup.full_name, u.name) as user_full_name
     FROM service_request_funeral_options srf
     JOIN service_requests sr ON sr.id = srf.request_id
     JOIN users u ON u.id = sr.user_id
     LEFT JOIN end_user_profiles eup ON eup.user_id = u.id
     WHERE srf.id = $1 AND srf.funeral_org_id = $2`,
    [optionId, orgId]
  );
  return rows[0] || null;
}

export async function updateFuneralLeadStatus(orgId, optionId, status, internalNotes = null) {
  if (!FUNERAL_STATUSES.includes(status)) {
    const err = new Error('INVALID_STATUS');
    err.httpStatus = 400;
    throw err;
  }
  const detail = await getFuneralLeadDetail(orgId, optionId);
  if (!detail) {
    const err = new Error('NOT_FOUND');
    err.httpStatus = 404;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE service_request_funeral_options
     SET status = $1,
         internal_notes = COALESCE($2, internal_notes)
     WHERE id = $3 AND funeral_org_id = $4
     RETURNING *`,
    [status, internalNotes, optionId, orgId]
  );
  const updated = rows[0];
  return { ...detail, status: updated.status, internal_notes: updated.internal_notes };
}
