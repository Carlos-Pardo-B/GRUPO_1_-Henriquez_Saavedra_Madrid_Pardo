import { pool } from '../config/db.js';

const CEMETERY_STATUSES = ['NEW', 'VIEWED', 'CONTACTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

export async function getCemeteryLeadsForOrg(orgId) {
  const { rows } = await pool.query(
    `SELECT src.id,
            src.request_id,
            src.status,
            src.notes_for_cemetery,
            src.internal_notes,
            src.created_at,
            sr.title as request_title,
            sr.service_type as request_service_type,
            sr.region as request_region,
            sr.comuna as request_comuna,
            sr.status as request_status,
            u.email as user_email,
            coalesce(eup.full_name, u.name) as user_full_name
     FROM service_request_cemetery_options src
     JOIN service_requests sr ON sr.id = src.request_id
     JOIN users u ON u.id = sr.user_id
     LEFT JOIN end_user_profiles eup ON eup.user_id = u.id
     WHERE src.cemetery_org_id = $1
     ORDER BY src.created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function getCemeteryLeadDetail(orgId, optionId) {
  const { rows } = await pool.query(
    `SELECT src.*,
            sr.title as request_title,
            sr.service_type as request_service_type,
            sr.region as request_region,
            sr.comuna as request_comuna,
            sr.description as request_description,
            sr.status as request_status,
            u.email as user_email,
            coalesce(eup.full_name, u.name) as user_full_name
     FROM service_request_cemetery_options src
     JOIN service_requests sr ON sr.id = src.request_id
     JOIN users u ON u.id = sr.user_id
     LEFT JOIN end_user_profiles eup ON eup.user_id = u.id
     WHERE src.id = $1 AND src.cemetery_org_id = $2`,
    [optionId, orgId]
  );
  return rows[0] || null;
}

export async function updateCemeteryLeadStatus(orgId, optionId, status, internalNotes = null) {
  if (!CEMETERY_STATUSES.includes(status)) {
    const err = new Error('INVALID_STATUS');
    err.httpStatus = 400;
    throw err;
  }
  const detail = await getCemeteryLeadDetail(orgId, optionId);
  if (!detail) {
    const err = new Error('NOT_FOUND');
    err.httpStatus = 404;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE service_request_cemetery_options
     SET status = $1,
         internal_notes = COALESCE($2, internal_notes)
     WHERE id = $3 AND cemetery_org_id = $4
     RETURNING *`,
    [status, internalNotes, optionId, orgId]
  );
  const updated = rows[0];
  return { ...detail, status: updated.status, internal_notes: updated.internal_notes };
}
