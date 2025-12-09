import { query } from '../config/db.js';

const MARKETPLACE_FIELDS = [
  'is_listed_public',
  'status',
  'public_name',
  'public_description',
  'website_url',
  'phone',
  'approved_by',
  'approved_at',
  'rejection_reason'
];

export async function getMarketplaceSettings(orgId) {
  const res = await query(
    'SELECT * FROM organization_marketplace_settings WHERE organization_id = $1',
    [orgId]
  );
  return res.rows[0] || null;
}

export async function upsertMarketplaceSettings(orgId, data) {
  const entries = MARKETPLACE_FIELDS.filter((field) => data[field] !== undefined);
  if (entries.length === 0) {
    return getMarketplaceSettings(orgId);
  }

  const columns = ['organization_id', ...entries];
  const placeholders = columns.map((_, idx) => `$${idx + 1}`);
  const values = [orgId, ...entries.map((f) => data[f])];
  const setClauses = entries.map((field) => `${field} = EXCLUDED.${field}`);
  setClauses.push('updated_at = NOW()');

  const res = await query(
    `INSERT INTO organization_marketplace_settings (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (organization_id) DO UPDATE SET ${setClauses.join(', ')}
     RETURNING *`,
    values
  );

  return res.rows[0];
}
