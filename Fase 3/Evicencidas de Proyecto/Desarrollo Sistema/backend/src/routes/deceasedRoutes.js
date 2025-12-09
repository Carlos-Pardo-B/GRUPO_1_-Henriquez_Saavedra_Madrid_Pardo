import express from 'express';
import {
  createDeceasedRecord,
  deleteDeceasedRecord,
  getDeceasedRecordById,
  listDeceasedRecords
} from '../services/deceasedService.js';

const router = express.Router();

// All routes assume authRequired + orgContextRequired + siteContextRequired applied upstream

router.post('/', async (req, res) => {
  try {
    const orgId = req.user.active_org;
    const siteId = req.user.active_site;
    const record = await createDeceasedRecord(orgId, siteId, req.body || {});
    return res.status(201).json({ deceased: record });
  } catch (err) {
    console.error('POST /org/deceased error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/', async (req, res) => {
  try {
    const orgId = req.user.active_org;
    const siteId = req.user.active_site;
    const deceased = await listDeceasedRecords(orgId, siteId);
    return res.json({ deceased });
  } catch (err) {
    console.error('GET /org/deceased error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const orgId = req.user.active_org;
    const siteId = req.user.active_site;
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId)) return res.status(400).json({ error: 'INVALID_DECEASED_ID' });
    const record = await getDeceasedRecordById(orgId, siteId, recordId);
    if (!record) return res.status(404).json({ error: 'DECEASED_NOT_FOUND' });
    return res.json({ deceased: record });
  } catch (err) {
    console.error('GET /org/deceased/:id error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.user.active_org;
    const siteId = req.user.active_site;
    const recordId = Number(req.params.id);
    if (!Number.isInteger(recordId)) return res.status(400).json({ error: 'INVALID_DECEASED_ID' });
    await deleteDeceasedRecord(orgId, siteId, recordId);
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/deceased/:id error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
