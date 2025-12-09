import { pool } from '../config/db.js';

const CATEGORIES = ['FLOWERS', 'CLEANING', 'MUSIC', 'PHOTOGRAPHY', 'DECORATION', 'TRANSPORT', 'DIGITAL', 'OTHER'];

export async function getProductsForOrganization(orgId) {
  const { rows } = await pool.query(
    `SELECT * FROM marketplace_products WHERE organization_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  return rows;
}

export async function getProductByIdForOrganization(orgId, productId) {
  const { rows } = await pool.query(
    `SELECT * FROM marketplace_products WHERE organization_id = $1 AND id = $2`,
    [orgId, productId]
  );
  return rows[0] || null;
}

export async function createProductForOrganization(orgId, data = {}) {
  const {
    site_id = null,
    code = null,
    name,
    description = null,
    category = 'OTHER',
    base_price = null,
    price_from = null,
    price_to = null,
    region = null,
    comuna = null,
    is_active = true,
  } = data;
  if (!name || !CATEGORIES.includes(category)) {
    const err = new Error('INVALID_DATA');
    err.httpStatus = 400;
    throw err;
  }
  const { rows } = await pool.query(
    `INSERT INTO marketplace_products (
      organization_id, site_id, code, name, description, category, base_price, price_from, price_to, region, comuna, is_active
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [orgId, site_id, code, name, description, category, base_price, price_from, price_to, region, comuna, is_active]
  );
  return rows[0];
}

export async function updateProductForOrganization(orgId, productId, data = {}) {
  const allowed = ['site_id', 'code', 'name', 'description', 'category', 'base_price', 'price_from', 'price_to', 'region', 'comuna', 'is_active'];
  const set = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in data) {
      set.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx += 1;
    }
  }
  if (!set.length) {
    return getProductByIdForOrganization(orgId, productId);
  }
  values.push(orgId, productId);
  const { rows } = await pool.query(
    `UPDATE marketplace_products SET ${set.join(', ')}, updated_at = NOW()
     WHERE organization_id = $${idx} AND id = $${idx + 1}
     RETURNING *`,
    values
  );
  return rows[0] || null;
}

export async function deleteProductForOrganization(orgId, productId) {
  await pool.query(`DELETE FROM marketplace_products WHERE organization_id = $1 AND id = $2`, [orgId, productId]);
  return true;
}

export async function addProductPhoto(orgId, productId, data = {}) {
  const { url, caption = null, sort_order = null } = data;
  if (!url) {
    const err = new Error('URL_REQUIRED');
    err.httpStatus = 400;
    throw err;
  }
  const exists = await getProductByIdForOrganization(orgId, productId);
  if (!exists) {
    const err = new Error('NOT_FOUND');
    err.httpStatus = 404;
    throw err;
  }
  const { rows } = await pool.query(
    `INSERT INTO marketplace_product_photos (product_id, url, caption, sort_order)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [productId, url, caption, sort_order]
  );
  return rows[0];
}

export async function getProductPhotos(productId) {
  const { rows } = await pool.query(
    `SELECT * FROM marketplace_product_photos WHERE product_id = $1 ORDER BY sort_order NULLS LAST, created_at DESC`,
    [productId]
  );
  return rows;
}
