export function superAdminRequired(req, res, next) {
  if (!req.user || req.user.is_superadmin !== true) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  return next();
}
