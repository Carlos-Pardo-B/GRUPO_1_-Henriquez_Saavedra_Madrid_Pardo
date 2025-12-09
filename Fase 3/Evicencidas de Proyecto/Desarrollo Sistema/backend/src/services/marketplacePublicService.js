import { pool } from '../config/db.js';

function normExpr(col) {
  return `lower(translate(coalesce(${col},''),'ÁÀÂÄáàâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖóòôöÚÙÛÜúùûÑñ','AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'))`;
}

export async function searchMarketplaceProducts({ region = null, comuna = null, category = null, org_type = null }) {
  const params = [];
  let where = `mp.is_active = true`;
  if (category) {
    params.push(category);
    where += ` AND mp.category = $${params.length}`;
  }
  if (org_type) {
    params.push(org_type);
    where += ` AND o.type = $${params.length}`;
  }
  if (region) {
    params.push(region.toLowerCase());
    where += ` AND ${normExpr('mp.region')} LIKE '%' || $${params.length} || '%'`;
  }
  if (comuna) {
    params.push(comuna.toLowerCase());
    where += ` AND ${normExpr('mp.comuna')} LIKE '%' || $${params.length} || '%'`;
  }
  const { rows } = await pool.query(
    `SELECT mp.*, o.name as organization_name, o.type as organization_type
     FROM marketplace_products mp
     JOIN organizations o ON o.id = mp.organization_id
     WHERE ${where}
     ORDER BY mp.created_at DESC`,
    params
  );
  return rows;
}

export async function getMarketplaceProductPublic(id) {
  const { rows } = await pool.query(
    `SELECT mp.*, o.name as organization_name, o.type as organization_type
     FROM marketplace_products mp
     JOIN organizations o ON o.id = mp.organization_id
     WHERE mp.id = $1`,
    [id]
  );
  const product = rows[0];
  if (!product || !product.is_active) return null;
  const photos = await pool.query(
    `SELECT * FROM marketplace_product_photos WHERE product_id = $1 ORDER BY sort_order NULLS LAST, created_at DESC`,
    [id]
  );
  return { product, photos: photos.rows };
}
