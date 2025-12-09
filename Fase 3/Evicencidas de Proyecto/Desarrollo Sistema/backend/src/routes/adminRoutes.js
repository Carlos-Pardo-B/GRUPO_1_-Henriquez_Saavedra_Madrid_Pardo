import express from 'express';
import {
  getAllPlans,
  createPlan,
  updatePlan,
  setPlanActive,
  getPlanById
} from '../services/planService.js';
import {
  getOrganizationSubscription,
  setOrganizationSubscription
} from '../services/organizationSubscriptionService.js';
import {
  listOrganizationsWithDetails,
  getOrganizationDetails
} from '../services/orgService.js';
import {
  upsertMarketplaceSettings
} from '../services/organizationMarketplaceService.js';
import {
  getSecuritySettings,
  upsertSecuritySettings
} from '../services/securitySettingsService.js';
import {
  getGlobalFlags,
  setGlobalFlag,
  getOrganizationFlags,
  setOrganizationFlag
} from '../services/featureFlagService.js';
import {
  logAdminAction,
  listAdminActions
} from '../services/adminAuditService.js';

const router = express.Router();

const mapError = (err) => {
  if (err.code === 'INVALID_SUBSCRIPTION_STATUS') {
    return { status: 400, payload: { error: 'INVALID_SUBSCRIPTION_STATUS' } };
  }
  if (err.code === '23505') {
    return { status: 409, payload: { error: 'DUPLICATE' } };
  }
  if (err.code === '23514') {
    return { status: 400, payload: { error: 'INVALID_VALUE' } };
  }
  return { status: 500, payload: { error: 'INTERNAL_ERROR', message: err.message } };
};

router.get('/plans', async (req, res) => {
  try {
    const plans = await getAllPlans({ includeInactive: true });
    return res.json({ plans });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'CODE_AND_NAME_REQUIRED' });
    }

    const plan = await createPlan(req.body);
    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: 'PLAN_CREATED',
      targetType: 'PLAN',
      targetId: plan.id,
      metadata: { code: plan.code }
    });
    return res.status(201).json({ plan });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.put('/plans/:id', async (req, res) => {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId)) {
      return res.status(400).json({ error: 'INVALID_PLAN_ID' });
    }
    const existing = await getPlanById(planId);
    if (!existing) {
      return res.status(404).json({ error: 'PLAN_NOT_FOUND' });
    }

    const plan = await updatePlan(planId, req.body);
    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: 'PLAN_UPDATED',
      targetType: 'PLAN',
      targetId: planId,
      metadata: { changes: req.body }
    });
    return res.json({ plan });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.patch('/plans/:id/status', async (req, res) => {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId)) {
      return res.status(400).json({ error: 'INVALID_PLAN_ID' });
    }
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'IS_ACTIVE_REQUIRED' });
    }

    const updated = await setPlanActive(planId, is_active);
    if (!updated) {
      return res.status(404).json({ error: 'PLAN_NOT_FOUND' });
    }

    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: is_active ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
      targetType: 'PLAN',
      targetId: planId
    });

    return res.json({ plan: updated });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.get('/organizations/:id/subscription', async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    if (!Number.isInteger(orgId)) {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });
    }
    const subscription = await getOrganizationSubscription(orgId);
    return res.json({ subscription });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.post('/organizations/:id/subscription', async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    if (!Number.isInteger(orgId)) {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });
    }

    const planId = Number(req.body.planId);
    const { status, ...extra } = req.body;

    if (!Number.isInteger(planId) || !status) {
      return res.status(400).json({ error: 'PLAN_AND_STATUS_REQUIRED' });
    }

    const plan = await getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'PLAN_NOT_FOUND' });
    }

    const subscription = await setOrganizationSubscription(orgId, planId, status, extra);
    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: 'SUBSCRIPTION_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: orgId,
      metadata: { planId, status }
    });
    return res.status(201).json({ subscription });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.get('/organizations', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const organizations = await listOrganizationsWithDetails({ limit, offset });
    return res.json({ organizations, pagination: { limit, offset } });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.get('/organizations/:id', async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    if (!Number.isInteger(orgId)) {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });
    }
    const organization = await getOrganizationDetails(orgId);
    if (!organization) {
      return res.status(404).json({ error: 'ORGANIZATION_NOT_FOUND' });
    }
    return res.json({ organization });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.patch('/organizations/:id/marketplace', async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    if (!Number.isInteger(orgId)) {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });
    }

    const data = { ...req.body };
    if (data.status === 'APPROVED' || data.status === 'REJECTED') {
      data.approved_by = req.user.sub;
      data.approved_at = new Date();
    }

    const settings = await upsertMarketplaceSettings(orgId, data);
    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: 'MARKETPLACE_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: orgId,
      metadata: data
    });
    return res.json({ settings });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.get('/feature-flags/global', async (req, res) => {
  try {
    const flags = await getGlobalFlags();
    return res.json({ flags });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.patch('/feature-flags/global', async (req, res) => {
  try {
    const payloadFlags = Array.isArray(req.body.flags)
      ? req.body.flags
      : req.body.flags
        ? Object.entries(req.body.flags).map(([key, value]) => ({ key, value }))
        : req.body.flag_key
          ? [{ key: req.body.flag_key, value: req.body.flag_value }]
          : [];

    if (payloadFlags.length === 0) {
      return res.status(400).json({ error: 'FLAGS_REQUIRED' });
    }

    const results = [];
    for (const entry of payloadFlags) {
      const saved = await setGlobalFlag(entry.key, entry.value, req.user.sub);
      results.push(saved);
    }

    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: 'GLOBAL_FLAGS_UPDATED',
      targetType: 'FEATURE_FLAG',
      targetId: null,
      metadata: { flags: payloadFlags }
    });

    return res.json({ flags: results });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.get('/organizations/:id/feature-flags', async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    if (!Number.isInteger(orgId)) {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });
    }
    const flags = await getOrganizationFlags(orgId);
    return res.json({ flags });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.patch('/organizations/:id/feature-flags', async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    if (!Number.isInteger(orgId)) {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION_ID' });
    }

    const payloadFlags = Array.isArray(req.body.flags)
      ? req.body.flags
      : req.body.flags
        ? Object.entries(req.body.flags).map(([key, value]) => ({ key, value }))
        : req.body.flag_key
          ? [{ key: req.body.flag_key, value: req.body.flag_value }]
          : [];

    if (payloadFlags.length === 0) {
      return res.status(400).json({ error: 'FLAGS_REQUIRED' });
    }

    const results = [];
    for (const entry of payloadFlags) {
      const saved = await setOrganizationFlag(orgId, entry.key, entry.value, req.user.sub);
      results.push(saved);
    }

    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: 'ORG_FLAGS_UPDATED',
      targetType: 'FEATURE_FLAG',
      targetId: orgId,
      metadata: { flags: payloadFlags }
    });

    return res.json({ flags: results });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.get('/security/settings', async (req, res) => {
  try {
    const settings = await getSecuritySettings();
    return res.json({ settings });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.patch('/security/settings', async (req, res) => {
  try {
    const updated = await upsertSecuritySettings(req.body);
    await logAdminAction({
      adminUserId: req.user.sub,
      actionType: 'SECURITY_SETTINGS_UPDATED',
      targetType: 'GLOBAL_CONFIG',
      targetId: updated.id,
      metadata: req.body
    });
    return res.json({ settings: updated });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

router.get('/logs/actions', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const logs = await listAdminActions({ limit, offset });
    return res.json({ logs, pagination: { limit, offset } });
  } catch (err) {
    console.error(err);
    const { status, payload } = mapError(err);
    return res.status(status).json(payload);
  }
});

export default router;
