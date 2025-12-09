import express from 'express';
import { pool } from '../config/db.js';
import {
  getServicesForOrganization,
  createServiceForOrganization,
  updateService,
  deleteService
} from '../services/funeralServiceCatalogService.js';
import {
  getPackagesForOrganization,
  createPackageForOrganization,
  updatePackage,
  deletePackage,
  getPackageItems,
  addItemToPackage,
  removeItemFromPackage
} from '../services/funeralPackagesService.js';
import {
  createBurialRequest,
  getBurialRequestsForFuneralOrg
} from '../services/burialRequestService.js';
import {
  getFuneralSitesByOrganization,
  createFuneralSite,
  updateFuneralSite,
  deleteFuneralSite,
  getFuneralSiteForOrganization
} from '../services/funeralSiteService.js';

const router = express.Router();

function requireFuneralOrg(req, res) {
  if (req.user?.active_org_type !== 'FUNERARIA') {
    res.status(403).json({ error: 'ORG_NOT_FUNERARIA' });
    return false;
  }
  return true;
}

// Catalog: services
router.get('/services', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const services = await getServicesForOrganization(req.user.active_org);
    return res.json({ services });
  } catch (err) {
    console.error('GET /org/funeral/services error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/services', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const service = await createServiceForOrganization(req.user.active_org, req.body || {});
    return res.status(201).json({ service });
  } catch (err) {
    console.error('POST /org/funeral/services error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/services/:id', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const service = await updateService(req.user.active_org, Number(req.params.id), req.body || {});
    return res.json({ service });
  } catch (err) {
    console.error('PATCH /org/funeral/services/:id error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/services/:id', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    await deleteService(req.user.active_org, Number(req.params.id));
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/funeral/services/:id error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Packages
router.get('/packages', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const packages = await getPackagesForOrganization(req.user.active_org);
    return res.json({ packages });
  } catch (err) {
    console.error('GET /org/funeral/packages error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/packages', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const pkg = await createPackageForOrganization(req.user.active_org, req.body || {});
    return res.status(201).json({ package: pkg });
  } catch (err) {
    console.error('POST /org/funeral/packages error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/packages/:id', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const pkg = await updatePackage(req.user.active_org, Number(req.params.id), req.body || {});
    return res.json({ package: pkg });
  } catch (err) {
    console.error('PATCH /org/funeral/packages/:id error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/packages/:id', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    await deletePackage(req.user.active_org, Number(req.params.id));
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/funeral/packages/:id error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/packages/:id/items', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const items = await getPackageItems(req.user.active_org, Number(req.params.id));
    return res.json({ items });
  } catch (err) {
    console.error('GET /org/funeral/packages/:id/items error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/packages/:id/items', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const { service_id, quantity } = req.body || {};
    const item = await addItemToPackage(req.user.active_org, Number(req.params.id), service_id, quantity);
    return res.status(201).json({ item });
  } catch (err) {
    console.error('POST /org/funeral/packages/:id/items error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/package-items/:itemId', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    await removeItemFromPackage(req.user.active_org, Number(req.params.itemId));
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/funeral/package-items/:itemId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Burial requests (funeraria)
router.get('/burial-requests', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const requests = await getBurialRequestsForFuneralOrg(req.user.active_org);
    return res.json({ requests });
  } catch (err) {
    console.error('GET /org/funeral/burial-requests error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/burial-requests', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const request = await createBurialRequest(req.user.active_org, req.body || {});
    return res.status(201).json({ request });
  } catch (err) {
    console.error('POST /org/funeral/burial-requests error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Cemetery lookup for funeraria
router.get('/cemeteries', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.name
       FROM organizations o
       WHERE o.type = 'CEMENTERIO'
       ORDER BY o.name ASC`
    );
    const cemeteries = [];
    for (const row of rows) {
      const sitesRes = await pool.query(
        `SELECT id, name FROM cemetery_sites WHERE organization_id = $1 ORDER BY name ASC`,
        [row.id]
      );
      cemeteries.push({ id: row.id, name: row.name, sites: sitesRes.rows });
    }
    return res.json({ cemeteries });
  } catch (err) {
    console.error('GET /org/funeral/cemeteries error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Plot types for funeraria
router.get('/plot-types', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, code, name, default_capacity_spaces, description
       FROM cemetery_plot_types
       ORDER BY name ASC`
    );
    return res.json({ plot_types: rows });
  } catch (err) {
    console.error('GET /org/funeral/plot-types error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Funeral sites (branches)
router.get('/sites', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const sites = await getFuneralSitesByOrganization(req.user.active_org);
    return res.json({ sites });
  } catch (err) {
    console.error('GET /org/funeral/sites error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/sites', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const site = await createFuneralSite(req.user.active_org, req.body || {});
    return res.status(201).json({ site });
  } catch (err) {
    console.error('POST /org/funeral/sites error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/sites/:id', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const site = await updateFuneralSite(req.user.active_org, Number(req.params.id), req.body || {});
    if (!site) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ site });
  } catch (err) {
    console.error('PATCH /org/funeral/sites/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/sites/:id', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const exists = await getFuneralSiteForOrganization(req.user.active_org, Number(req.params.id));
    if (!exists) return res.status(404).json({ error: 'NOT_FOUND' });
    await deleteFuneralSite(req.user.active_org, Number(req.params.id));
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/funeral/sites/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
