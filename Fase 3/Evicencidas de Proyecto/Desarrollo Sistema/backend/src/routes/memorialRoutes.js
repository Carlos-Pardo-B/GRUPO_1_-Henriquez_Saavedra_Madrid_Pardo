import express from 'express';
import {
  createMemorialForDeceased,
  getMemorialsForUser,
  getMemorialByIdForUser,
  updateMemorial,
  addMemorialMember,
  removeMemorialMember,
  addMemorialPhoto,
  getMemorialPhotos,
  getMemorialPublicBySlug,
  getMemorialPublicByQrToken,
  addMemorialMessage,
  getMemorialMessages,
} from '../services/memorialService.js';

const userRouter = express.Router();
const publicRouter = express.Router();

// User-protected routes
userRouter.get('/', async (req, res) => {
  try {
    const list = await getMemorialsForUser(req.user.sub);
    return res.json({ memorials: list });
  } catch (err) {
    console.error('GET /user/memorials error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.post('/', async (req, res) => {
  try {
    const memorial = await createMemorialForDeceased(req.user.sub, req.body.deceased_id, req.body || {});
    return res.status(201).json({ memorial });
  } catch (err) {
    console.error('POST /user/memorials error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.get('/:id', async (req, res) => {
  try {
    const memorial = await getMemorialByIdForUser(Number(req.params.id), req.user.sub);
    if (!memorial) return res.status(404).json({ error: 'NOT_FOUND' });
    const photos = await getMemorialPhotos(memorial.id);
    const messages = await getMemorialMessages(memorial.id);
    return res.json({ memorial, photos, messages });
  } catch (err) {
    console.error('GET /user/memorials/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.patch('/:id', async (req, res) => {
  try {
    const memorial = await updateMemorial(req.user.sub, Number(req.params.id), req.body || {});
    return res.json({ memorial });
  } catch (err) {
    console.error('PATCH /user/memorials/:id error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.post('/:id/members', async (req, res) => {
  try {
    const member = await addMemorialMember(req.user.sub, Number(req.params.id), req.body.user_id, req.body.role || 'EDITOR');
    return res.status(201).json({ member });
  } catch (err) {
    console.error('POST /user/memorials/:id/members error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.delete('/:id/members/:userId', async (req, res) => {
  try {
    await removeMemorialMember(req.user.sub, Number(req.params.id), Number(req.params.userId));
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE /user/memorials/:id/members/:userId error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.post('/:id/photos', async (req, res) => {
  try {
    const photo = await addMemorialPhoto(req.user.sub, Number(req.params.id), req.body.url, req.body.caption, req.body.sort_order);
    return res.status(201).json({ photo });
  } catch (err) {
    console.error('POST /user/memorials/:id/photos error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.get('/:id/photos', async (req, res) => {
  try {
    const photos = await getMemorialPhotos(Number(req.params.id));
    return res.json({ photos });
  } catch (err) {
    console.error('GET /user/memorials/:id/photos error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

userRouter.post('/:id/messages', async (req, res) => {
  try {
    const msg = await addMemorialMessage(Number(req.params.id), req.user.sub, req.body.author_name || null, req.body.text);
    return res.status(201).json({ message: msg });
  } catch (err) {
    console.error('POST /user/memorials/:id/messages error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

// Public routes
publicRouter.get('/slug/:slug', async (req, res) => {
  try {
    const data = await getMemorialPublicBySlug(req.params.slug);
    if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(data);
  } catch (err) {
    console.error('GET /public/memorials/slug/:slug error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

publicRouter.get('/qr/:token', async (req, res) => {
  try {
    const data = await getMemorialPublicByQrToken(req.params.token);
    if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.json(data);
  } catch (err) {
    console.error('GET /public/memorials/qr/:token error', err);
    return res.status(err.httpStatus || 500).json({ error: err.error || 'INTERNAL_ERROR' });
  }
});

export default { userRouter, publicRouter };
