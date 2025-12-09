import { query } from '../config/db.js';

export async function getGlobalFlags() {
  const res = await query(
    'SELECT flag_key, flag_value, created_by, created_at FROM global_feature_flags ORDER BY flag_key ASC'
  );
  return res.rows;
}

export async function setGlobalFlag(flagKey, flagValue, createdBy = null) {
  const res = await query(
    `INSERT INTO global_feature_flags (flag_key, flag_value, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (flag_key) DO UPDATE
       SET flag_value = EXCLUDED.flag_value,
           created_by = COALESCE(EXCLUDED.created_by, global_feature_flags.created_by)
     RETURNING *`,
    [flagKey, flagValue, createdBy]
  );
  return res.rows[0];
}

export async function getOrganizationFlags(orgId) {
  const res = await query(
    `SELECT flag_key, flag_value, created_by, created_at
     FROM organization_feature_flags
     WHERE organization_id = $1
     ORDER BY flag_key ASC`,
    [orgId]
  );
  return res.rows;
}

export async function setOrganizationFlag(orgId, flagKey, flagValue, createdBy = null) {
  const res = await query(
    `INSERT INTO organization_feature_flags (organization_id, flag_key, flag_value, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, flag_key) DO UPDATE
       SET flag_value = EXCLUDED.flag_value,
           created_by = COALESCE(EXCLUDED.created_by, organization_feature_flags.created_by)
     RETURNING *`,
    [orgId, flagKey, flagValue, createdBy]
  );
  return res.rows[0];
}

export async function getEffectiveFlags(orgId) {
  const [globalRes, orgRes] = await Promise.all([
    getGlobalFlags(),
    getOrganizationFlags(orgId)
  ]);

  const combined = new Map(globalRes.map((row) => [row.flag_key, row.flag_value]));
  for (const row of orgRes) {
    combined.set(row.flag_key, row.flag_value);
  }

  return Object.fromEntries(combined.entries());
}
