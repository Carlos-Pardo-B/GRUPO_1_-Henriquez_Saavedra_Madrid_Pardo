import express from 'express';
import {
  getCemeteryLeadsForOrg,
  getCemeteryLeadDetail,
  updateCemeteryLeadStatus
} from '../services/cemeteryLeadsService.js';

const router = express.Router();

function requireCemeteryOrg(req, res) {
  if (req.user?.user_type !== 'ORG' || req.user?.active_org_type !== 'CEMENTERIO') {
    res.status(403).json({ error: 'ORG_NOT_CEMENTERIO' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  if (!requireCemeteryOrg(req, res)) return;
  try {
    const leads = await getCemeteryLeadsForOrg(req.user.active_org);
    return res.json({ leads });
  } catch (err) {
    console.error('GET /org/cemetery/leads error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  if (!requireCemeteryOrg(req, res)) return;
  try {
    const lead = await getCemeteryLeadDetail(req.user.active_org, Number(req.params.id));
    if (!lead) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ lead });
  } catch (err) {
    console.error('GET /org/cemetery/leads/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/:id/status', async (req, res) => {
  if (!requireCemeteryOrg(req, res)) return;
  const { status, internal_notes = null } = req.body || {};
  if (!status) return res.status(400).json({ error: 'STATUS_REQUIRED' });
  try {
    const lead = await updateCemeteryLeadStatus(req.user.active_org, Number(req.params.id), status, internal_notes);
    return res.json({ lead });
  } catch (err) {
    console.error('PATCH /org/cemetery/leads/:id/status error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
