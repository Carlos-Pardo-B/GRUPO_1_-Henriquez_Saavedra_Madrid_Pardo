import { query } from '../config/db.js';

export async function getUserOrganizations(userId) {
  const res = await query(
    `SELECT 
       ou.role,
       o.id,
       o.name,
       o.type
     FROM organization_users ou
     JOIN organizations o ON o.id = ou.organization_id
     WHERE ou.user_id = $1 AND ou.is_active = true`,
    [userId]
  );
  return res.rows;
}

export async function getOrganizationMembership(userId, orgId) {
  const res = await query(
    `SELECT ou.role, o.id, o.name, o.type
     FROM organization_users ou
     JOIN organizations o ON o.id = ou.organization_id
     WHERE ou.user_id = $1 AND ou.organization_id = $2 AND ou.is_active = true`,
    [userId, orgId]
  );
  return res.rows[0] || null;
}

export async function listOrganizationsWithDetails({ limit = 50, offset = 0 } = {}) {
  const res = await query(
    `SELECT
        o.*,
        os.plan_id,
        os.status AS subscription_status,
        os.current_period_end,
        os.trial_ends_at,
        os.started_at AS subscription_started_at,
        p.code AS plan_code,
        p.name AS plan_name,
        oms.is_listed_public,
        oms.status AS marketplace_status
     FROM organizations o
     LEFT JOIN LATERAL (
        SELECT *
        FROM organization_subscriptions
        WHERE organization_id = o.id
        ORDER BY started_at DESC
        LIMIT 1
     ) os ON TRUE
     LEFT JOIN plans p ON p.id = os.plan_id
     LEFT JOIN organization_marketplace_settings oms ON oms.organization_id = o.id
     ORDER BY o.id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return res.rows;
}

export async function getOrganizationDetails(orgId) {
  const res = await query(
    `SELECT
        o.*,
        os.plan_id,
        os.status AS subscription_status,
        os.current_period_end,
        os.trial_ends_at,
        os.started_at AS subscription_started_at,
        p.code AS plan_code,
        p.name AS plan_name,
        oms.is_listed_public,
        oms.status AS marketplace_status
     FROM organizations o
     LEFT JOIN LATERAL (
        SELECT *
        FROM organization_subscriptions
        WHERE organization_id = o.id
        ORDER BY started_at DESC
        LIMIT 1
     ) os ON TRUE
     LEFT JOIN plans p ON p.id = os.plan_id
     LEFT JOIN organization_marketplace_settings oms ON oms.organization_id = o.id
     WHERE o.id = $1`,
    [orgId]
  );
  return res.rows[0] || null;
}
