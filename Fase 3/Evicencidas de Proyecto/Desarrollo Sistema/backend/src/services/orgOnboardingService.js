import { pool } from '../config/db.js';
import { hashPassword } from '../utils/password.js';
import { getPlanById } from './planService.js';
import { findUserByEmail } from './userService.js';

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    const err = new Error('INVALID_PAYLOAD');
    err.httpStatus = 400;
    throw err;
  }

  const { organization, adminUser, planId } = payload;

  if (!organization || typeof organization !== 'object') {
    const err = new Error('ORGANIZATION_REQUIRED');
    err.httpStatus = 400;
    throw err;
  }
  if (!adminUser || typeof adminUser !== 'object') {
    const err = new Error('ADMIN_USER_REQUIRED');
    err.httpStatus = 400;
    throw err;
  }
  if (!Number.isInteger(Number(planId))) {
    const err = new Error('PLAN_ID_REQUIRED');
    err.httpStatus = 400;
    throw err;
  }

  const requiredOrg = ['name', 'type'];
  for (const field of requiredOrg) {
    if (!organization[field]) {
      const err = new Error('ORGANIZATION_FIELDS_REQUIRED');
      err.httpStatus = 400;
      err.details = { missing: field };
      throw err;
    }
  }

  const requiredAdmin = ['name', 'email', 'password'];
  for (const field of requiredAdmin) {
    if (!adminUser[field]) {
      const err = new Error('ADMIN_USER_FIELDS_REQUIRED');
      err.httpStatus = 400;
      err.details = { missing: field };
      throw err;
    }
  }
}

export async function registerOrganizationWithAdmin(payload) {
  validatePayload(payload);

  const { organization, adminUser, planId } = payload;

  // Basic checks before transaction
  const existing = await findUserByEmail(adminUser.email);
  if (existing) {
    const err = new Error('EMAIL_ALREADY_EXISTS');
    err.httpStatus = 409;
    throw err;
  }

  const plan = await getPlanById(Number(planId));
  if (!plan) {
    const err = new Error('PLAN_NOT_FOUND');
    err.httpStatus = 400;
    throw err;
  }
  if (plan.is_active === false) {
    const err = new Error('PLAN_INACTIVE');
    err.httpStatus = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create organization
    const orgInsert = await client.query(
      `INSERT INTO organizations (
         name, type, status, contact_name, contact_email, contact_phone
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, type, status`,
      [
        organization.name,
        organization.type,
        'PENDING',
        organization.contact_name || null,
        organization.contact_email || null,
        organization.contact_phone || null
      ]
    );
    const org = orgInsert.rows[0];

    // Create admin user (ORG)
    const password_hash = await hashPassword(adminUser.password);
    const userInsert = await client.query(
      `INSERT INTO users (email, password_hash, name, user_type, is_superadmin)
       VALUES ($1, $2, $3, 'ORG', false)
       RETURNING id, email, name, user_type, is_superadmin, created_at`,
      [adminUser.email, password_hash, adminUser.name]
    );
    const user = userInsert.rows[0];

    // Link user to organization as ADMIN
    await client.query(
      `INSERT INTO organization_users (user_id, organization_id, role, is_active)
       VALUES ($1, $2, 'ADMIN', true)`,
      [user.id, org.id]
    );

    // Create initial subscription (TRIAL by default)
    const subInsert = await client.query(
      `INSERT INTO organization_subscriptions (
         organization_id, plan_id, status, started_at
       ) VALUES ($1, $2, $3, NOW())
       RETURNING id, organization_id, plan_id, status, started_at`,
      [org.id, plan.id, 'TRIAL']
    );
    const subscription = subInsert.rows[0];

    await client.query('COMMIT');

    return {
      message: 'ORGANIZATION_REGISTERED',
      organization: org,
      adminUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type
      },
      subscription: {
        id: subscription.id,
        plan_id: subscription.plan_id,
        status: subscription.status
      }
    };
  } catch (err) {
    await client.query('ROLLBACK');
    // Map unique violation on users.email
    if (err && err.code === '23505') {
      const dup = new Error('EMAIL_ALREADY_EXISTS');
      dup.httpStatus = 409;
      throw dup;
    }
    throw err;
  } finally {
    client.release();
  }
}

