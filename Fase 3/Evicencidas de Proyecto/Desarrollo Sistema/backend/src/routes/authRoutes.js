import express from 'express';
import { createUser, findUserByEmail } from '../services/userService.js';
import { login, selectOrganization } from '../services/authService.js';
import { authRequired } from '../middleware/authMiddleware.js';
import { enforcePasswordPolicy } from '../services/securitySettingsService.js';
import { findUserById } from '../services/userService.js';
import { getUserOrganizations } from '../services/orgService.js';
import { getSitesByOrganization, getSiteById } from '../services/siteService.js';

const router = express.Router();

// Registro usuario público
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'NAME_EMAIL_PASSWORD_REQUIRED', message: 'name, email and password are required' });
    }

    try {
      await enforcePasswordPolicy(password);
    } catch (policyErr) {
      if (policyErr.code === 'WEAK_PASSWORD') {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Password does not meet policy requirements',
          min_length: policyErr.min_password_length
        });
      }
      throw policyErr;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS', message: 'Email is already in use' });
    }

    const user = await createUser({ email, password, name, user_type: 'PUBLIC' });

    return res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
});

// Login único para todos
router.post('/login', async (req, res) => {
  try {
    const { email, password, organizationId } = req.body;

    const result = await login(email, password, { organizationId });

    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    if (err.message === 'INVALID_ORGANIZATION') {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION' });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Seleccionar organización (cuando tiene varias)
router.post('/select-organization', authRequired, async (req, res) => {
  try {
    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ error: 'ORGANIZATION_ID_REQUIRED' });
    }

    const result = await selectOrganization(req.user, organizationId);
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err.message === 'INVALID_ORGANIZATION') {
      return res.status(400).json({ error: 'INVALID_ORGANIZATION' });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Ver perfil con contexto
router.get('/me', authRequired, async (req, res) => {
  try {
    const baseUser = await findUserById(req.user.sub);
    if (!baseUser) return res.status(401).json({ error: 'INVALID_TOKEN' });

    const organizations = await getUserOrganizations(req.user.sub);
    const activeOrgId = req.user.active_org;
    const activeOrg =
      activeOrgId && organizations.find((o) => o.id === activeOrgId)
        ? organizations.find((o) => o.id === activeOrgId)
        : null;

    let sites = [];
    let activeSite = null;
    if (activeOrg && activeOrg.type === 'CEMENTERIO') {
      sites = await getSitesByOrganization(activeOrg.id);
      if (req.user.active_site) {
        const site = await getSiteById(req.user.active_site);
        if (site && site.organization_id === activeOrg.id) {
          activeSite = site;
        }
      }
    }

    return res.json({
      user: {
        id: baseUser.id,
        email: baseUser.email,
        name: baseUser.name,
        user_type: baseUser.user_type,
        is_superadmin: baseUser.is_superadmin,
        organizations,
        active_organization: activeOrg || null,
        sites,
        active_site: activeSite
      }
    });
  } catch (err) {
    console.error('GET /auth/me error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
