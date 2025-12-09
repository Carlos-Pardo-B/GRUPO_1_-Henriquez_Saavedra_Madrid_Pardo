export function siteContextRequired(req, res, next) {
  if (!req.user || !req.user.active_site) {
    return res.status(400).json({ error: 'NO_ACTIVE_SITE' });
  }
  next();
}

