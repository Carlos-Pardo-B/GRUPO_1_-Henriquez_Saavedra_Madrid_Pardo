import express from 'express';
import {
  getFuneralLeadsForOrg,
  getFuneralLeadDetail,
  updateFuneralLeadStatus
} from '../services/funeralLeadsService.js';

const router = express.Router();

function requireFuneralOrg(req, res) {
  if (req.user?.user_type !== 'ORG' || req.user?.active_org_type !== 'FUNERARIA') {
    res.status(403).json({ error: 'ORG_NOT_FUNERARIA' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const leads = await getFuneralLeadsForOrg(req.user.active_org);
    return res.json({ leads });
  } catch (err) {
    console.error('GET /org/funeral/leads error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  try {
    const lead = await getFuneralLeadDetail(req.user.active_org, Number(req.params.id));
    if (!lead) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json({ lead });
  } catch (err) {
    console.error('GET /org/funeral/leads/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/:id/status', async (req, res) => {
  if (!requireFuneralOrg(req, res)) return;
  const { status, internal_notes = null } = req.body || {};
  if (!status) return res.status(400).json({ error: 'STATUS_REQUIRED' });
  try {
    const lead = await updateFuneralLeadStatus(req.user.active_org, Number(req.params.id), status, internal_notes);
    return res.json({ lead });
  } catch (err) {
    console.error('PATCH /org/funeral/leads/:id/status error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
