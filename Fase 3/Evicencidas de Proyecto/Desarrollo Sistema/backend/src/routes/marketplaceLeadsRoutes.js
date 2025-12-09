import express from 'express';
import {
  createMarketplaceLead,
  getLeadsForOrganization,
  updateLeadStatusForOrganization,
  getLeadsForUser
} from '../services/marketplaceLeadsService.js';

const orgRouter = express.Router();
const userRouter = express.Router();

// Org side
orgRouter.get('/', async (req, res) => {
  try {
    const leads = await getLeadsForOrganization(req.user.active_org);
    return res.json({ leads });
  } catch (err) {
    console.error('GET /org/marketplace/leads error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

orgRouter.patch('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'STATUS_REQUIRED' });
  try {
    const lead = await updateLeadStatusForOrganization(req.user.active_org, Number(req.params.id), status);
    return res.json({ lead });
  } catch (err) {
    console.error('PATCH /org/marketplace/leads/:id/status error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// User side
userRouter.get('/', async (req, res) => {
  try {
    const leads = await getLeadsForUser(req.user.sub);
    return res.json({ leads });
  } catch (err) {
    console.error('GET /user/marketplace/leads error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.post('/', async (req, res) => {
  try {
    const lead = await createMarketplaceLead(req.user.sub, req.body || {});
    return res.status(201).json({ lead });
  } catch (err) {
    console.error('POST /user/marketplace/leads error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default { orgRouter, userRouter };
