import express from 'express';
import {
  getAreasBySite,
  createArea,
  getSectorsByArea,
  createSector,
  getSubsectorsBySector,
  createSubsector,
  updateArea,
  updateSector,
  updateSubsector,
  deleteArea,
  deleteSector,
  deleteSubsector
} from '../services/cemeteryStructureService.js';
import { getPlotTypes, createPlot, getPlotsBySubsector, deletePlot } from '../services/cemeteryPlotsService.js';
import { getSpacesByPlot, updateSpaceStatus } from '../services/cemeterySpacesService.js';
import { getCemeteryDashboard } from '../services/cemeteryDashboardService.js';
import {
  getBurialRequestsForCemeteryOrg,
  approveBurialRequest,
  rejectBurialRequest,
  assignPlotToBurialRequest
} from '../services/burialRequestService.js';

const router = express.Router();

// All routes here assume authRequired + orgContextRequired + siteContextRequired applied upstream

// Areas
router.get('/areas', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const areas = await getAreasBySite(siteId);
    return res.json({ areas });
  } catch (err) {
    console.error('GET /org/cemetery/areas error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/areas', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const area = await createArea(siteId, req.body || {});
    return res.status(201).json({ area });
  } catch (err) {
    console.error('POST /org/cemetery/areas error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/areas/:areaId', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const areaId = Number(req.params.areaId);
    if (!Number.isInteger(areaId)) {
      return res.status(400).json({ error: 'INVALID_AREA_ID' });
    }
    const area = await updateArea(siteId, areaId, req.body || {});
    if (!area) return res.status(404).json({ error: 'AREA_NOT_FOUND' });
    return res.json({ area });
  } catch (err) {
    console.error('PATCH /org/cemetery/areas/:areaId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/areas/:areaId', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const areaId = Number(req.params.areaId);
    if (!Number.isInteger(areaId)) {
      return res.status(400).json({ error: 'INVALID_AREA_ID' });
    }
    await deleteArea(siteId, areaId);
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/cemetery/areas/:areaId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Sectors
router.get('/areas/:areaId/sectors', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const areaId = Number(req.params.areaId);
    if (!Number.isInteger(areaId)) {
      return res.status(400).json({ error: 'INVALID_AREA_ID' });
    }
    const sectors = await getSectorsByArea(siteId, areaId);
    return res.json({ sectors });
  } catch (err) {
    console.error('GET /org/cemetery/areas/:areaId/sectors error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/areas/:areaId/sectors', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const areaId = Number(req.params.areaId);
    if (!Number.isInteger(areaId)) {
      return res.status(400).json({ error: 'INVALID_AREA_ID' });
    }
    const sector = await createSector(siteId, areaId, req.body || {});
    return res.status(201).json({ sector });
  } catch (err) {
    console.error('POST /org/cemetery/areas/:areaId/sectors error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/sectors/:sectorId', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const sectorId = Number(req.params.sectorId);
    if (!Number.isInteger(sectorId)) {
      return res.status(400).json({ error: 'INVALID_SECTOR_ID' });
    }
    const sector = await updateSector(siteId, sectorId, req.body || {});
    if (!sector) return res.status(404).json({ error: 'SECTOR_NOT_FOUND' });
    return res.json({ sector });
  } catch (err) {
    console.error('PATCH /org/cemetery/sectors/:sectorId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/sectors/:sectorId', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const sectorId = Number(req.params.sectorId);
    if (!Number.isInteger(sectorId)) {
      return res.status(400).json({ error: 'INVALID_SECTOR_ID' });
    }
    await deleteSector(siteId, sectorId);
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/cemetery/sectors/:sectorId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Subsectors
router.get('/sectors/:sectorId/subsectors', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const sectorId = Number(req.params.sectorId);
    if (!Number.isInteger(sectorId)) {
      return res.status(400).json({ error: 'INVALID_SECTOR_ID' });
    }
    const subsectors = await getSubsectorsBySector(siteId, sectorId);
    return res.json({ subsectors });
  } catch (err) {
    console.error('GET /org/cemetery/sectors/:sectorId/subsectors error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/sectors/:sectorId/subsectors', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const sectorId = Number(req.params.sectorId);
    if (!Number.isInteger(sectorId)) {
      return res.status(400).json({ error: 'INVALID_SECTOR_ID' });
    }
    const subsector = await createSubsector(siteId, sectorId, req.body || {});
    return res.status(201).json({ subsector });
  } catch (err) {
    console.error('POST /org/cemetery/sectors/:sectorId/subsectors error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/subsectors/:subsectorId', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const subsectorId = Number(req.params.subsectorId);
    if (!Number.isInteger(subsectorId)) {
      return res.status(400).json({ error: 'INVALID_SUBSECTOR_ID' });
    }
    const subsector = await updateSubsector(siteId, subsectorId, req.body || {});
    if (!subsector) return res.status(404).json({ error: 'SUBSECTOR_NOT_FOUND' });
    return res.json({ subsector });
  } catch (err) {
    console.error('PATCH /org/cemetery/subsectors/:subsectorId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/subsectors/:subsectorId', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const subsectorId = Number(req.params.subsectorId);
    if (!Number.isInteger(subsectorId)) {
      return res.status(400).json({ error: 'INVALID_SUBSECTOR_ID' });
    }
    await deleteSubsector(siteId, subsectorId);
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/cemetery/subsectors/:subsectorId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Plot types
router.get('/plot-types', async (req, res) => {
  try {
    const types = await getPlotTypes();
    return res.json({ plot_types: types });
  } catch (err) {
    console.error('GET /org/cemetery/plot-types error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create plot under a subsector (and auto-generate spaces)
router.post('/subsectors/:subsectorId/plots', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const subsectorId = Number(req.params.subsectorId);
    if (!Number.isInteger(subsectorId)) {
      return res.status(400).json({ error: 'INVALID_SUBSECTOR_ID' });
    }
    const plot = await createPlot(siteId, subsectorId, req.body || {});
    return res.status(201).json({ plot });
  } catch (err) {
    console.error('POST /org/cemetery/subsectors/:subsectorId/plots error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/subsectors/:subsectorId/plots', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const subsectorId = Number(req.params.subsectorId);
    if (!Number.isInteger(subsectorId)) {
      return res.status(400).json({ error: 'INVALID_SUBSECTOR_ID' });
    }
    const plots = await getPlotsBySubsector(siteId, subsectorId);
    return res.json({ plots });
  } catch (err) {
    console.error('GET /org/cemetery/subsectors/:subsectorId/plots error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Spaces of a plot
router.get('/plots/:plotId/spaces', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const plotId = Number(req.params.plotId);
    if (!Number.isInteger(plotId)) {
      return res.status(400).json({ error: 'INVALID_PLOT_ID' });
    }
    const spaces = await getSpacesByPlot(siteId, plotId);
    return res.json({ spaces });
  } catch (err) {
    console.error('GET /org/cemetery/plots/:plotId/spaces error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Update space status
router.patch('/spaces/:spaceId/status', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const spaceId = Number(req.params.spaceId);
    if (!Number.isInteger(spaceId)) {
      return res.status(400).json({ error: 'INVALID_SPACE_ID' });
    }
    const space = await updateSpaceStatus(siteId, spaceId, req.body || {});
    return res.json({ space });
  } catch (err) {
    console.error('PATCH /org/cemetery/spaces/:spaceId/status error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/plots/:plotId', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const plotId = Number(req.params.plotId);
    if (!Number.isInteger(plotId)) {
      return res.status(400).json({ error: 'INVALID_PLOT_ID' });
    }
    await deletePlot(siteId, plotId);
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/cemetery/plots/:plotId error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Burial requests for cemetery
router.get('/burial-requests', async (req, res) => {
  if (req.user?.active_org_type !== 'CEMENTERIO') {
    return res.status(403).json({ error: 'ORG_NOT_CEMETERY' });
  }
  try {
    const orgId = req.user.active_org;
    const siteId = req.user.active_site || null;
    const requests = await getBurialRequestsForCemeteryOrg(orgId, siteId);
    return res.json({ requests });
  } catch (err) {
    console.error('GET /org/cemetery/burial-requests error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/burial-requests/:id/approve', async (req, res) => {
  if (req.user?.active_org_type !== 'CEMENTERIO') {
    return res.status(403).json({ error: 'ORG_NOT_CEMETERY' });
  }
  try {
    const result = await approveBurialRequest(req.user.active_org, Number(req.params.id));
    return res.json({ request: result });
  } catch (err) {
    console.error('PATCH /org/cemetery/burial-requests/:id/approve error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/burial-requests/:id/reject', async (req, res) => {
  if (req.user?.active_org_type !== 'CEMENTERIO') {
    return res.status(403).json({ error: 'ORG_NOT_CEMETERY' });
  }
  try {
    const { reason = null } = req.body || {};
    const result = await rejectBurialRequest(req.user.active_org, Number(req.params.id), reason);
    return res.json({ request: result });
  } catch (err) {
    console.error('PATCH /org/cemetery/burial-requests/:id/reject error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/burial-requests/:id/assign-plot', async (req, res) => {
  if (req.user?.active_org_type !== 'CEMENTERIO') {
    return res.status(403).json({ error: 'ORG_NOT_CEMETERY' });
  }
  try {
    const { plot_id, space_id } = req.body || {};
    if (!plot_id || !space_id) {
      return res.status(400).json({ error: 'PLOT_AND_SPACE_REQUIRED' });
    }
    const result = await assignPlotToBurialRequest(
      req.user.active_org,
      req.user.active_site,
      Number(req.params.id),
      plot_id,
      space_id
    );
    return res.json(result);
  } catch (err) {
    console.error('PATCH /org/cemetery/burial-requests/:id/assign-plot error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const siteId = req.user.active_site;
    const dashboard = await getCemeteryDashboard(siteId);
    return res.json(dashboard);
  } catch (err) {
    console.error('GET /org/cemetery/dashboard error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
