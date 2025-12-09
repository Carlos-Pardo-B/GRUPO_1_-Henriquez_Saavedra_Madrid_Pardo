import { query } from '../config/db.js';

export async function logAdminAction({
  adminUserId,
  actionType,
  targetType,
  targetId = null,
  metadata = {},
  ipAddress = null,
  userAgent = null
}) {
  const res = await query(
    `INSERT INTO admin_actions_log (
        admin_user_id, action_type, target_type, target_id,
        metadata, ip_address, user_agent
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [adminUserId, actionType, targetType, targetId, metadata, ipAddress, userAgent]
  );
  return res.rows[0];
}

export async function listAdminActions({ limit = 50, offset = 0 } = {}) {
  const res = await query(
    `SELECT *
     FROM admin_actions_log
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return res.rows;
}
