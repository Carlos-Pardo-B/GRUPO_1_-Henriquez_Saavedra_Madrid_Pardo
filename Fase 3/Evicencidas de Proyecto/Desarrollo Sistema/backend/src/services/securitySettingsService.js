import { query } from '../config/db.js';

const DEFAULT_SECURITY_SETTINGS = {
  id: null,
  min_password_length: 8,
  require_2fa_for_org_admins: false,
  lockout_threshold: 10,
  lockout_duration_minutes: 15
};

export async function getSecuritySettings() {
  const res = await query(
    'SELECT * FROM security_settings_global ORDER BY id DESC LIMIT 1'
  );
  return res.rows[0] || { ...DEFAULT_SECURITY_SETTINGS };
}

export async function upsertSecuritySettings(updates = {}) {
  const current = await getSecuritySettings();
  const nextValues = {
    min_password_length: updates.min_password_length ?? current.min_password_length ?? DEFAULT_SECURITY_SETTINGS.min_password_length,
    require_2fa_for_org_admins: updates.require_2fa_for_org_admins ?? current.require_2fa_for_org_admins ?? DEFAULT_SECURITY_SETTINGS.require_2fa_for_org_admins,
    lockout_threshold: updates.lockout_threshold ?? current.lockout_threshold ?? DEFAULT_SECURITY_SETTINGS.lockout_threshold,
    lockout_duration_minutes: updates.lockout_duration_minutes ?? current.lockout_duration_minutes ?? DEFAULT_SECURITY_SETTINGS.lockout_duration_minutes
  };

  const res = await query(
    `INSERT INTO security_settings_global (
        id, min_password_length, require_2fa_for_org_admins,
        lockout_threshold, lockout_duration_minutes, updated_at
     )
     VALUES (
        1, $1, $2, $3, $4, NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
        min_password_length = EXCLUDED.min_password_length,
        require_2fa_for_org_admins = EXCLUDED.require_2fa_for_org_admins,
        lockout_threshold = EXCLUDED.lockout_threshold,
        lockout_duration_minutes = EXCLUDED.lockout_duration_minutes,
        updated_at = NOW()
     RETURNING *`,
    [
      nextValues.min_password_length,
      nextValues.require_2fa_for_org_admins,
      nextValues.lockout_threshold,
      nextValues.lockout_duration_minutes
    ]
  );

  return res.rows[0];
}

export async function enforcePasswordPolicy(password) {
  const settings = await getSecuritySettings();
  if (!password || password.length < settings.min_password_length) {
    const err = new Error('WEAK_PASSWORD');
    err.code = 'WEAK_PASSWORD';
    err.min_password_length = settings.min_password_length;
    throw err;
  }
  return settings;
}
