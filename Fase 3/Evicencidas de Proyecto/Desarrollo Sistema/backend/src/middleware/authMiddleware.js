import { verifyAccessToken } from '../utils/jwt.js';

export function authRequired(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'NO_TOKEN' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload; // sub, email, utype, active_org, role, is_superadmin
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

// opcional: middleware para endpoints de organización
export function orgContextRequired(req, res, next) {
  if (!req.user || !req.user.active_org) {
    return res.status(400).json({ error: 'NO_ACTIVE_ORGANIZATION' });
  }
  next();
}
