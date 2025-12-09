import express from 'express';
import { getAllPlans, getPlanById } from '../services/planService.js';
import { registerOrganizationWithAdmin } from '../services/orgOnboardingService.js';
import { publicSearchDeceased } from '../services/deceasedService.js';

const router = express.Router();

router.get('/plans', async (req, res) => {
  try {
    const plans = await getAllPlans({ includeInactive: false });
    const simplified = plans.map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      price_monthly_cents: p.price_monthly_cents
    }));
    return res.json(simplified);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
});

router.post('/org-register', async (req, res) => {
  try {
    const result = await registerOrganizationWithAdmin(req.body);
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    if (err.httpStatus) {
      // known validation/business errors
      return res.status(err.httpStatus).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    if (err.message === 'INVALID_SUBSCRIPTION_STATUS') {
      return res.status(400).json({ error: 'INVALID_SUBSCRIPTION_STATUS' });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  }
});

router.get('/deceased', async (req, res) => {
  try {
    const search = req.query.search || '';
    const results = await publicSearchDeceased(search);
    return res.json({ results });
  } catch (err) {
    console.error('GET /public/deceased error', err);
    return res.status(err.status || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
