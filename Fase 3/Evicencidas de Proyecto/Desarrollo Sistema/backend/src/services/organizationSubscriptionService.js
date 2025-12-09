import { pool, query } from '../config/db.js';

const ACTIVE_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE'];
const ALLOWED_STATUSES = [...ACTIVE_STATUSES, 'CANCELED'];

export async function getOrganizationSubscription(organizationId) {
  const res = await query(
    `SELECT 
        os.*,
        p.code AS plan_code,
        p.name AS plan_name
     FROM organization_subscriptions os
     JOIN plans p ON p.id = os.plan_id
     WHERE os.organization_id = $1
       AND os.status = ANY($2::text[])
     ORDER BY os.started_at DESC
     LIMIT 1`,
    [organizationId, ACTIVE_STATUSES]
  );
  return res.rows[0] || null;
}

export async function setOrganizationSubscription(organizationId, planId, status, extraData = {}) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error('INVALID_SUBSCRIPTION_STATUS');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE organization_subscriptions
       SET status = 'CANCELED', canceled_at = NOW()
       WHERE organization_id = $1
         AND status = ANY($2::text[])`,
      [organizationId, ACTIVE_STATUSES]
    );

    const {
      started_at = null,
      trial_ends_at = null,
      current_period_end = null,
      canceled_at = null,
      external_customer_id = null,
      external_subscription_id = null
    } = extraData;

    const insertRes = await client.query(
      `INSERT INTO organization_subscriptions (
          organization_id, plan_id, status,
          started_at, trial_ends_at, current_period_end, canceled_at,
          external_customer_id, external_subscription_id
       )
       VALUES (
          $1, $2, $3,
          COALESCE($4, NOW()), $5, $6, $7,
          $8, $9
       )
       RETURNING *`,
      [
        organizationId,
        planId,
        status,
        started_at,
        trial_ends_at,
        current_period_end,
        canceled_at,
        external_customer_id,
        external_subscription_id
      ]
    );

    await client.query('COMMIT');
    return insertRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
