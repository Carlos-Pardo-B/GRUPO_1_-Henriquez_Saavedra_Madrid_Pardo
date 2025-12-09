import { validateUserCredentials, findUserById } from './userService.js';
import { getUserOrganizations, getOrganizationMembership } from './orgService.js';
import { getSitesByOrganization, getSiteById } from './siteService.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';

function buildTokenPayload(user, activeOrg, activeSite = null) {
  return {
    sub: user.id,
    email: user.email,
    utype: user.user_type, // PUBLIC | ORG | SUPERADMIN
    is_superadmin: user.is_superadmin,
    active_org: activeOrg ? activeOrg.id : null,
    active_org_type: activeOrg ? activeOrg.type : null,
    active_site: activeSite ? activeSite.id : null,
    role: activeOrg ? activeOrg.role : null
  };
}

export async function login(email, password, { organizationId = null } = {}) {
  const user = await validateUserCredentials(email, password);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  let organizations = [];
  let activeOrg = null;
  let sites = [];
  let activeSite = null;

  if (user.user_type === 'ORG' || user.is_superadmin) {
    organizations = await getUserOrganizations(user.id);

    if (organizationId) {
      activeOrg = await getOrganizationMembership(user.id, organizationId);
      if (!activeOrg) {
        throw new Error('INVALID_ORGANIZATION');
      }
    } else if (organizations.length === 1) {
      activeOrg = organizations[0];
    } else {
      // varias orgs y no seleccionó: devolvemos sin active_org
      activeOrg = null;
    }
  }

  if (activeOrg) {
    if (activeOrg.type === 'CEMENTERIO') {
      sites = await getSitesByOrganization(activeOrg.id);
      // Policy adjustment: if org has exactly one site, auto-select it
      activeSite = sites.length === 1 ? sites[0] : null;
    } else {
      sites = [];
      activeSite = null;
    }
  }

  const payload = buildTokenPayload(user, activeOrg, activeSite);

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: user.id });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      user_type: user.user_type,
      is_superadmin: user.is_superadmin,
      organizations,
      active_organization: activeOrg,
      sites,
      active_site: activeSite
    }
  };
}

export async function selectOrganization(user, organizationId) {
  const membership = await getOrganizationMembership(user.sub, organizationId);
  if (!membership) {
    throw new Error('INVALID_ORGANIZATION');
  }

  // Build a fresh payload (avoid copying exp/iat from req.user)
  const baseUser = {
    id: user.sub,
    email: user.email,
    user_type: user.utype,
    is_superadmin: user.is_superadmin
  };
  // If the selected org has exactly one site, auto-select it
  let activeSite = null;
  try {
    if (membership.type === 'CEMENTERIO') {
      const sites = await getSitesByOrganization(membership.id);
      if (sites.length === 1) activeSite = sites[0];
    }
  } catch (e) {
    // ignore site lookup errors here
  }
  const payload = buildTokenPayload(baseUser, { id: membership.id, role: membership.role, type: membership.type }, activeSite);

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: user.sub });
  return {
    accessToken,
    refreshToken,
    active_organization: membership
  };
}

export async function selectSite(user, siteId) {
  if (!user.active_org) {
    const e = new Error('NO_ACTIVE_ORGANIZATION');
    e.httpStatus = 400;
    throw e;
  }
  const numericSiteId = Number(siteId);
  if (!Number.isInteger(numericSiteId)) {
    const e = new Error('INVALID_SITE');
    e.httpStatus = 400;
    throw e;
  }

  const site = await getSiteById(numericSiteId);
  if (!site) {
    const e = new Error('INVALID_SITE');
    e.httpStatus = 400;
    throw e;
  }
  if (site.organization_id !== user.active_org) {
    const e = new Error('FORBIDDEN_SITE');
    e.httpStatus = 403;
    throw e;
  }
  if (site.status !== 'ACTIVE') {
    const e = new Error('INVALID_SITE');
    e.httpStatus = 400;
    throw e;
  }

  // Build a fresh payload (avoid copying exp/iat from req.user)
  const baseUser = {
    id: user.sub,
    email: user.email,
    user_type: user.utype,
    is_superadmin: user.is_superadmin
  };
  const activeOrg = { id: user.active_org, role: user.role, type: user.active_org_type || null };
  const payload = buildTokenPayload(baseUser, activeOrg, { id: site.id });

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ sub: user.sub });
  return {
    message: 'SITE_SELECTED',
    active_site: {
      id: site.id,
      name: site.name,
      region: site.region,
      comuna: site.comuna
    },
    accessToken,
    refreshToken
  };
}
