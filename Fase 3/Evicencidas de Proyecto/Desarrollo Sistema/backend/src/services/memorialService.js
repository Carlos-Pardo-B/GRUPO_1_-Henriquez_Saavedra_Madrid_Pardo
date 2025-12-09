import { randomBytes } from 'crypto';
import { pool } from '../config/db.js';

function genToken() {
  return randomBytes(32).toString('hex');
}

async function assertMember(memorialId, userId) {
  const { rows } = await pool.query(
    `SELECT role FROM memorial_members WHERE memorial_id = $1 AND user_id = $2`,
    [memorialId, userId]
  );
  return rows[0] || null;
}

function canAdmin(role) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function createMemorialForDeceased(userId, deceasedId, payload = {}) {
  const {
    title = '',
    short_message = null,
    biography = null,
    theme = 'CLASSIC',
    visibility = 'PUBLIC'
  } = payload;
  const qrToken = genToken();
  const slugBase = (title || `memorial-${deceasedId}`).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const { rows } = await pool.query(
    `INSERT INTO memorials (deceased_id, created_by_user_id, title, short_message, biography, theme, visibility, qr_token, slug)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CONCAT($9,'-',floor(random()*100000)::text))
     RETURNING *`,
    [deceasedId, userId, title, short_message, biography, theme, visibility, qrToken, slugBase || 'memorial']
  );
  const memorial = rows[0];
  await pool.query(
    `INSERT INTO memorial_members (memorial_id, user_id, role) VALUES ($1,$2,'OWNER') ON CONFLICT DO NOTHING`,
    [memorial.id, userId]
  );
  return memorial;
}

export async function getMemorialByIdForUser(memorialId, userId) {
  const { rows } = await pool.query(`SELECT * FROM memorials WHERE id = $1`, [memorialId]);
  const memorial = rows[0];
  if (!memorial) return null;
  if (memorial.visibility === 'PUBLIC' || memorial.visibility === 'UNLISTED') return memorial;
  const member = await assertMember(memorialId, userId);
  if (member) return memorial;
  return null;
}

export async function getMemorialsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT m.*
     FROM memorials m
     JOIN memorial_members mm ON mm.memorial_id = m.id
     WHERE mm.user_id = $1
     ORDER BY m.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function updateMemorial(userId, memorialId, payload = {}) {
  const member = await assertMember(memorialId, userId);
  if (!member || !canAdmin(member.role)) {
    const err = new Error('FORBIDDEN');
    err.httpStatus = 403;
    throw err;
  }
  const allowed = ['title', 'short_message', 'biography', 'theme', 'visibility'];
  const set = [];
  const vals = [];
  let i = 1;
  for (const k of allowed) {
    if (k in payload) {
      set.push(`${k} = $${i}`);
      vals.push(payload[k]);
      i += 1;
    }
  }
  if (!set.length) {
    const { rows } = await pool.query(`SELECT * FROM memorials WHERE id = $1`, [memorialId]);
    return rows[0] || null;
  }
  vals.push(memorialId);
  const { rows } = await pool.query(
    `UPDATE memorials SET ${set.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] || null;
}

export async function addMemorialMember(actorUserId, memorialId, targetUserId, role = 'EDITOR') {
  const member = await assertMember(memorialId, actorUserId);
  if (!member || !canAdmin(member.role)) {
    const err = new Error('FORBIDDEN');
    err.httpStatus = 403;
    throw err;
  }
  const { rows } = await pool.query(
    `INSERT INTO memorial_members (memorial_id, user_id, role)
     VALUES ($1,$2,$3)
     ON CONFLICT (memorial_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [memorialId, targetUserId, role]
  );
  return rows[0];
}

export async function removeMemorialMember(actorUserId, memorialId, targetUserId) {
  const member = await assertMember(memorialId, actorUserId);
  if (!member || !canAdmin(member.role)) {
    const err = new Error('FORBIDDEN');
    err.httpStatus = 403;
    throw err;
  }
  await pool.query(
    `DELETE FROM memorial_members WHERE memorial_id = $1 AND user_id = $2`,
    [memorialId, targetUserId]
  );
  return true;
}

export async function addMemorialPhoto(userId, memorialId, url, caption = null, sort_order = null) {
  const member = await assertMember(memorialId, userId);
  if (!member) {
    const err = new Error('FORBIDDEN');
    err.httpStatus = 403;
    throw err;
  }
  const { rows } = await pool.query(
    `INSERT INTO memorial_photos (memorial_id, url, caption, sort_order, uploaded_by_user_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [memorialId, url, caption, sort_order, userId]
  );
  return rows[0];
}

export async function getMemorialPhotos(memorialId) {
  const { rows } = await pool.query(
    `SELECT * FROM memorial_photos WHERE memorial_id = $1 ORDER BY sort_order NULLS LAST, created_at DESC`,
    [memorialId]
  );
  return rows;
}

export async function getMemorialPublicBySlug(slug) {
  const { rows } = await pool.query(`SELECT * FROM memorials WHERE slug = $1`, [slug]);
  const memorial = rows[0];
  if (!memorial) return null;
  if (memorial.visibility === 'PRIVATE') return null;
  const photos = await getMemorialPhotos(memorial.id);
  const messages = await getMemorialMessages(memorial.id);
  return { memorial, photos, messages };
}

export async function getMemorialPublicByQrToken(token) {
  const { rows } = await pool.query(`SELECT * FROM memorials WHERE qr_token = $1`, [token]);
  const memorial = rows[0];
  if (!memorial) return null;
  if (memorial.visibility === 'PRIVATE') return null;
  const photos = await getMemorialPhotos(memorial.id);
  const messages = await getMemorialMessages(memorial.id);
  return { memorial, photos, messages };
}

export async function addMemorialMessage(memorialId, userId, authorName, text) {
  const { rows } = await pool.query(
    `INSERT INTO memorial_messages (memorial_id, user_id, author_name, text)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [memorialId, userId, authorName, text]
  );
  return rows[0];
}

export async function getMemorialMessages(memorialId) {
  const { rows } = await pool.query(
    `SELECT * FROM memorial_messages WHERE memorial_id = $1 ORDER BY created_at DESC`,
    [memorialId]
  );
  return rows;
}
