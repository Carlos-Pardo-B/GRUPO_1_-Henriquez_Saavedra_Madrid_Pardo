import express from 'express';
import {
  getProductsForOrganization,
  getProductByIdForOrganization,
  createProductForOrganization,
  updateProductForOrganization,
  deleteProductForOrganization,
  addProductPhoto,
  getProductPhotos
} from '../services/marketplaceProductService.js';

const router = express.Router();

router.get('/products', async (req, res) => {
  try {
    const products = await getProductsForOrganization(req.user.active_org);
    return res.json({ products });
  } catch (err) {
    console.error('GET /org/marketplace/products error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/products', async (req, res) => {
  try {
    const product = await createProductForOrganization(req.user.active_org, req.body || {});
    return res.status(201).json({ product });
  } catch (err) {
    console.error('POST /org/marketplace/products error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await getProductByIdForOrganization(req.user.active_org, Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'NOT_FOUND' });
    const photos = await getProductPhotos(product.id);
    return res.json({ product, photos });
  } catch (err) {
    console.error('GET /org/marketplace/products/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const product = await updateProductForOrganization(req.user.active_org, Number(req.params.id), req.body || {});
    return res.json({ product });
  } catch (err) {
    console.error('PATCH /org/marketplace/products/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await deleteProductForOrganization(req.user.active_org, Number(req.params.id));
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /org/marketplace/products/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.get('/products/:id/photos', async (req, res) => {
  try {
    const photos = await getProductPhotos(Number(req.params.id));
    return res.json({ photos });
  } catch (err) {
    console.error('GET /org/marketplace/products/:id/photos error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

router.post('/products/:id/photos', async (req, res) => {
  try {
    const photo = await addProductPhoto(req.user.active_org, Number(req.params.id), req.body || {});
    return res.status(201).json({ photo });
  } catch (err) {
    console.error('POST /org/marketplace/products/:id/photos error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default router;
