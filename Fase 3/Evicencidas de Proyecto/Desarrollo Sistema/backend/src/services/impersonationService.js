import { query } from '../config/db.js';

export async function startImpersonation(adminUserId, targetUserId, organizationId = null, reason = null) {
  const res = await query(
    `INSERT INTO admin_impersonations (
        admin_user_id, target_user_id, organization_id, reason
     )
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [adminUserId, targetUserId, organizationId, reason]
  );
  return res.rows[0];
}

export async function endImpersonation(impersonationId) {
  const res = await query(
    `UPDATE admin_impersonations
     SET ended_at = NOW()
     WHERE id = $1 AND ended_at IS NULL
     RETURNING *`,
    [impersonationId]
  );
  return res.rows[0] || null;
}
