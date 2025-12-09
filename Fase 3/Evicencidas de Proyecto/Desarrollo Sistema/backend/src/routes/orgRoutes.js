import express from 'express';
import { authRequired, orgContextRequired } from '../middleware/authMiddleware.js';
import { getSitesByOrganization, createSiteForOrganization } from '../services/siteService.js';
import { selectSite } from '../services/authService.js';

const router = express.Router();

// Require org context for all routes in this module
router.use(authRequired, orgContextRequired);

// GET /org/sites - list sites for active org
router.get('/sites', async (req, res) => {
  try {
    const orgId = req.user.active_org;
    const sites = await getSitesByOrganization(orgId);
    const simplified = sites.map(s => ({
      id: s.id,
      name: s.name,
      region: s.region,
      comuna: s.comuna,
      status: s.status
    }));
    return res.json(simplified);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /org/sites - create site (ADMIN only)
router.post('/sites', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    const orgId = req.user.active_org;
    const site = await createSiteForOrganization(orgId, req.body || {});
    return res.status(201).json(site);
  } catch (err) {
    console.error(err);
    if (err.httpStatus) {
      return res.status(err.httpStatus).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'DUPLICATE' });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /org/select-site - select active site and issue fresh tokens
router.post('/select-site', async (req, res) => {
  try {
    const { siteId } = req.body || {};
    if (!siteId) {
      return res.status(400).json({ error: 'SITE_ID_REQUIRED' });
    }
    const result = await selectSite(req.user, siteId);
    return res.json(result);
  } catch (err) {
    console.error(err);
    if (err.httpStatus) {
      const status = err.httpStatus;
      return res.status(status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
