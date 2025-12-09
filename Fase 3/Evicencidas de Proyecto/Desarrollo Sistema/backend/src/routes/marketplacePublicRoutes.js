import express from 'express';
import { searchMarketplaceProducts, getMarketplaceProductPublic } from '../services/marketplacePublicService.js';

const router = express.Router();

router.get('/products', async (req, res) => {
  try {
    const products = await searchMarketplaceProducts({
      region: req.query.region || null,
      comuna: req.query.comuna || null,
      category: req.query.category || null,
      org_type: req.query.org_type || null
    });
    return res.json({ products });
  } catch (err) {
    console.error('GET /public/marketplace/products error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const data = await getMarketplaceProductPublic(Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(data);
  } catch (err) {
    console.error('GET /public/marketplace/products/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
