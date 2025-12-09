import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

function ensureEndUser(req, res) {
  const type = req.user?.utype || req.user?.user_type;
  if (!type || (type !== 'END_USER' && type !== 'PUBLIC')) {
    res.status(403).json({ error: 'END_USER_ONLY' });
    return false;
  }
  return true;
}

// Normalize strings to compare region/comuna without case or accents
function normalizeValue(str) {
  if (!str) return null;
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Profile
router.get('/profile', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  try {
    const userRes = await pool.query(
      'SELECT id, email, name, user_type FROM users WHERE id = $1',
      [req.user.sub]
    );
    const profileRes = await pool.query(
      `SELECT id, user_id, full_name, phone, preferred_region, preferred_comuna, created_at
       FROM end_user_profiles WHERE user_id = $1`,
      [req.user.sub]
    );
    return res.json({
      user: userRes.rows[0],
      profile: profileRes.rows[0] || null
    });
  } catch (err) {
    console.error('GET /user/profile error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.put('/profile', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const { full_name = null, phone = null, preferred_region = null, preferred_comuna = null } = req.body || {};
  try {
    const upsert = await pool.query(
      `INSERT INTO end_user_profiles (user_id, full_name, phone, preferred_region, preferred_comuna)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           preferred_region = EXCLUDED.preferred_region,
           preferred_comuna = EXCLUDED.preferred_comuna
       RETURNING id, user_id, full_name, phone, preferred_region, preferred_comuna, created_at`,
      [req.user.sub, full_name, phone, preferred_region, preferred_comuna]
    );
    return res.json({ profile: upsert.rows[0] });
  } catch (err) {
    console.error('PUT /user/profile error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Helpers
async function assertOwnRequest(userId, requestId) {
  const res = await pool.query('SELECT * FROM service_requests WHERE id = $1 AND user_id = $2', [requestId, userId]);
  return res.rows[0] || null;
}

// Requests
router.get('/requests', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM service_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.sub]
    );
    return res.json({ requests: rows });
  } catch (err) {
    console.error('GET /user/requests error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/requests', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const {
    title,
    description = null,
    relationship = null,
    service_type,
    budget_min = null,
    budget_max = null,
    region,
    comuna
  } = req.body || {};
  if (!title || !service_type || !region || !comuna) {
    return res.status(400).json({ error: 'REQUIRED_FIELDS' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO service_requests (
        user_id, title, description, relationship, service_type, budget_min, budget_max, region, comuna, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OPEN')
      RETURNING *`,
      [req.user.sub, title, description, relationship, service_type, budget_min, budget_max, region, comuna]
    );
    return res.status(201).json({ request: rows[0] });
  } catch (err) {
    console.error('POST /user/requests error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/requests/:id', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(400).json({ error: 'INVALID_ID' });
  try {
    const reqRow = await assertOwnRequest(req.user.sub, rid);
    if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND' });
    const funRes = await pool.query(
      `SELECT srf.*, o.name AS organization_name
       FROM service_request_funeral_options srf
       LEFT JOIN organizations o ON o.id = srf.funeral_org_id
       WHERE srf.request_id = $1`,
      [rid]
    );
    const cemRes = await pool.query(
      `SELECT src.*, o.name AS organization_name
       FROM service_request_cemetery_options src
       LEFT JOIN organizations o ON o.id = src.cemetery_org_id
       WHERE src.request_id = $1`,
      [rid]
    );
    return res.json({ request: reqRow, funeral_options: funRes.rows, cemetery_options: cemRes.rows });
  } catch (err) {
    console.error('GET /user/requests/:id error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.put('/requests/:id', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(400).json({ error: 'INVALID_ID' });
  const reqRow = await assertOwnRequest(req.user.sub, rid);
  if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND' });
  if (reqRow.status !== 'OPEN') return res.status(400).json({ error: 'NOT_EDITABLE' });
  const allowed = [
    'title', 'description', 'relationship', 'service_type', 'budget_min', 'budget_max', 'region', 'comuna'
  ];
  const set = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
      set.push(`${key} = $${idx}`);
      values.push(req.body[key]);
      idx += 1;
    }
  }
  if (!set.length) return res.json({ request: reqRow });
  values.push(rid);
  try {
    const { rows } = await pool.query(
      `UPDATE service_requests SET ${set.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return res.json({ request: rows[0] });
  } catch (err) {
    console.error('PUT /user/requests/:id error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/requests/:id', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(400).json({ error: 'INVALID_ID' });
  const reqRow = await assertOwnRequest(req.user.sub, rid);
  if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    await pool.query(`UPDATE service_requests SET status = 'CANCELED' WHERE id = $1`, [rid]);
    return res.json({ message: 'CANCELED' });
  } catch (err) {
    console.error('DELETE /user/requests/:id error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Funeral options
router.get('/requests/:id/funeral-options', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(400).json({ error: 'INVALID_ID' });
  const reqRow = await assertOwnRequest(req.user.sub, rid);
  if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM service_request_funeral_options WHERE request_id = $1`,
      [rid]
    );
    return res.json({ options: rows });
  } catch (err) {
    console.error('GET funeral-options error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/requests/:id/funeral-options', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(400).json({ error: 'INVALID_ID' });
  const reqRow = await assertOwnRequest(req.user.sub, rid);
  if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND' });
  const { funeral_org_id, notes_for_funeral = null, preferred_package_id = null } = req.body || {};
  if (!funeral_org_id) return res.status(400).json({ error: 'FUNERAL_REQUIRED' });
  try {
    const orgCheck = await pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND type = 'FUNERARIA'`,
      [funeral_org_id]
    );
    if (orgCheck.rowCount === 0) return res.status(400).json({ error: 'INVALID_FUNERAL_ORG' });
    const { rows } = await pool.query(
      `INSERT INTO service_request_funeral_options (request_id, funeral_org_id, notes_for_funeral, preferred_package_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [rid, funeral_org_id, notes_for_funeral, preferred_package_id]
    );
    return res.status(201).json({ option: rows[0] });
  } catch (err) {
    console.error('POST funeral-options error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/funeral-options/:optionId', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const oid = Number(req.params.optionId);
  if (!Number.isInteger(oid)) return res.status(400).json({ error: 'INVALID_ID' });
  try {
    const optRes = await pool.query(
      `SELECT srf.request_id FROM service_request_funeral_options srf
       JOIN service_requests sr ON sr.id = srf.request_id
       WHERE srf.id = $1 AND sr.user_id = $2`,
      [oid, req.user.sub]
    );
    if (optRes.rowCount === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    await pool.query(`DELETE FROM service_request_funeral_options WHERE id = $1`, [oid]);
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE funeral-options error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Cemetery options
router.get('/requests/:id/cemetery-options', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(400).json({ error: 'INVALID_ID' });
  const reqRow = await assertOwnRequest(req.user.sub, rid);
  if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM service_request_cemetery_options WHERE request_id = $1`,
      [rid]
    );
    return res.json({ options: rows });
  } catch (err) {
    console.error('GET cemetery-options error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/requests/:id/cemetery-options', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(400).json({ error: 'INVALID_ID' });
  const reqRow = await assertOwnRequest(req.user.sub, rid);
  if (!reqRow) return res.status(404).json({ error: 'NOT_FOUND' });
  const { cemetery_org_id, preferred_plot_type_id = null, notes_for_cemetery = null } = req.body || {};
  if (!cemetery_org_id) return res.status(400).json({ error: 'CEMETERY_REQUIRED' });
  try {
    const orgCheck = await pool.query(
      `SELECT id FROM organizations WHERE id = $1 AND type = 'CEMENTERIO'`,
      [cemetery_org_id]
    );
    if (orgCheck.rowCount === 0) return res.status(400).json({ error: 'INVALID_CEMETERY_ORG' });
    const { rows } = await pool.query(
      `INSERT INTO service_request_cemetery_options (request_id, cemetery_org_id, preferred_plot_type_id, notes_for_cemetery)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [rid, cemetery_org_id, preferred_plot_type_id, notes_for_cemetery]
    );
    return res.status(201).json({ option: rows[0] });
  } catch (err) {
    console.error('POST cemetery-options error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/cemetery-options/:optionId', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const oid = Number(req.params.optionId);
  if (!Number.isInteger(oid)) return res.status(400).json({ error: 'INVALID_ID' });
  try {
    const optRes = await pool.query(
      `SELECT src.request_id FROM service_request_cemetery_options src
       JOIN service_requests sr ON sr.id = src.request_id
       WHERE src.id = $1 AND sr.user_id = $2`,
      [oid, req.user.sub]
    );
    if (optRes.rowCount === 0) return res.status(404).json({ error: 'NOT_FOUND' });
    await pool.query(`DELETE FROM service_request_cemetery_options WHERE id = $1`, [oid]);
    return res.json({ message: 'DELETED' });
  } catch (err) {
    console.error('DELETE cemetery-options error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Catalog
router.get('/catalog/funerarias', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  try {
    const { region = null, comuna = null } = req.query || {};
    const normRegion = normalizeValue(region);
    const normComuna = normalizeValue(comuna);
    const normExpr = (col) =>
      `lower(translate(coalesce(${col},''),'ÁÀÂÄáàâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖóòôöÚÙÛÜúùûÑñ','AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'))`;

    const params = [];
    let where = `o.type = 'FUNERARIA'`;
    let siteWhere = '';
    if (normRegion) {
      params.push(normRegion);
      siteWhere += ` AND ${normExpr('fs.region')} LIKE '%' || $${params.length} || '%'`;
    }
    if (normComuna) {
      params.push(normComuna);
      siteWhere += ` AND ${normExpr('fs.comuna')} LIKE '%' || $${params.length} || '%'`;
    }
    const { rows } = await pool.query(
      `SELECT fs.id as site_id, fs.name as site_name, fs.region, fs.comuna, fs.organization_id,
              o.name as org_name
       FROM funeral_sites fs
       JOIN organizations o ON o.id = fs.organization_id
       WHERE ${where}${siteWhere}`,
      params
    );
    const grouped = new Map();
    for (const r of rows) {
      const item = grouped.get(r.organization_id) || {
        id: r.organization_id,
        name: r.org_name,
        short_description: null,
        region: r.region || null,
        comuna: r.comuna || null,
        sites: [],
      };
      item.sites.push({
        id: r.site_id,
        name: r.site_name,
        region: r.region,
        comuna: r.comuna,
      });
      grouped.set(r.organization_id, item);
    }
    // Si no hay filtros y no hay sitios aún, devolvemos vacío; de lo contrario, solo con sitios.
    return res.json({ items: Array.from(grouped.values()) });
  } catch (err) {
    console.error('GET catalog funerarias error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/catalog/cementerios', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  const { region = null, comuna = null } = req.query || {};
  const normRegion = normalizeValue(region);
  const normComuna = normalizeValue(comuna);
  const normExpr = (col) =>
    `lower(translate(coalesce(${col},''),'ÁÀÂÄáàâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖóòôöÚÙÛÜúùûÑñ','AAAAaaaaEEEEeeeeIIIIiiiiOOOOooooUUUUuuuuNn'))`;
  try {
    const params = [];
    let where = `o.type = 'CEMENTERIO'`;
    if (normRegion) {
      params.push(normRegion);
      where += ` AND ${normExpr('cs.region')} LIKE '%' || $${params.length} || '%'`;
    }
    if (normComuna) {
      params.push(normComuna);
      where += ` AND ${normExpr('cs.comuna')} LIKE '%' || $${params.length} || '%'`;
    }

    const rows = await pool.query(
      `SELECT o.id as org_id, o.name as org_name,
              cs.id as site_id, cs.name as site_name, cs.region, cs.comuna
       FROM organizations o
       JOIN cemetery_sites cs ON cs.organization_id = o.id
       WHERE ${where}`,
      params
    );
    const items = [];
    const grouped = new Map();
    for (const r of rows.rows) {
      const item = grouped.get(r.org_id) || {
        id: r.org_id,
        name: r.org_name,
        short_description: null,
        region: r.region || null,
        comuna: r.comuna || null,
        sites: []
      };
      item.sites.push({ id: r.site_id, name: r.site_name, region: r.region, comuna: r.comuna });
      grouped.set(r.org_id, item);
    }
    return res.json({ items: Array.from(grouped.values()) });
  } catch (err) {
    console.error('GET catalog cementerios error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Static list of regions/comunas
const chileRegions = [
  { name: 'Arica y Parinacota', communes: ['Arica', 'Camarones', 'Putre', 'General Lagos'] },
  { name: 'Tarapacá', communes: ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camiña', 'Colchane', 'Huara', 'Pica'] },
  { name: 'Antofagasta', communes: ['Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollagüe', 'San Pedro de Atacama', 'Tocopilla', 'María Elena'] },
  { name: 'Atacama', communes: ['Copiapó', 'Caldera', 'Tierra Amarilla', 'Chañaral', 'Diego de Almagro', 'Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco'] },
  { name: 'Coquimbo', communes: ['La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paihuano', 'Vicuña', 'Illapel', 'Canela', 'Los Vilos', 'Salamanca', 'Ovalle', 'Combarbalá', 'Monte Patria', 'Punitaqui', 'Río Hurtado'] },
  { name: 'Valparaíso', communes: ['Valparaíso', 'Casablanca', 'Concón', 'Juan Fernández', 'Puchuncaví', 'Quintero', 'Viña del Mar', 'Isla de Pascua', 'Los Andes', 'Calle Larga', 'Rinconada', 'San Esteban', 'La Ligua', 'Cabildo', 'Papudo', 'Petorca', 'Zapallar', 'Quillota', 'Calera', 'Hijuelas', 'La Cruz', 'Nogales', 'San Antonio', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo', 'Santo Domingo', 'San Felipe', 'Catemu', 'Llaillay', 'Panquehue', 'Putaendo', 'Santa María', 'Quilpué', 'Limache', 'Olmué', 'Villa Alemana'] },
  { name: 'Metropolitana de Santiago', communes: ['Santiago', 'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba', 'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Vitacura', 'Puente Alto', 'Pirque', 'San José de Maipo', 'Colina', 'Lampa', 'Tiltil', 'San Bernardo', 'Buin', 'Calera de Tango', 'Paine', 'Melipilla', 'Alhué', 'Curacaví', 'María Pinto', 'San Pedro', 'Talagante', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor'] },
  { name: "O'Higgins", communes: ['Rancagua', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue', 'Graneros', 'Las Cabras', 'Machalí', 'Malloa', 'Mostazal', 'Olivar', 'Peumo', 'Pichidegua', 'Quinta de Tilcoco', 'Rengo', 'Requínoa', 'San Vicente', 'Pichilemu', 'La Estrella', 'Litueche', 'Marchihue', 'Navidad', 'Paredones', 'San Fernando', 'Chépica', 'Chimbarongo', 'Lolol', 'Nancagua', 'Palmilla', 'Peralillo', 'Placilla', 'Pumanque', 'Santa Cruz'] },
  { name: 'Maule', communes: ['Talca', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael', 'Cauquenes', 'Chanco', 'Pelluhue', 'Curicó', 'Hualañé', 'Licantén', 'Molina', 'Rauco', 'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquén', 'Linares', 'Colbún', 'Longaví', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre', 'Yerbas Buenas'] },
  { name: 'Ñuble', communes: ['Chillán', 'Bulnes', 'Chillán Viejo', 'El Carmen', 'Pemuco', 'Pinto', 'Quillón', 'San Ignacio', 'Yungay', 'Quirihue', 'Cobquecura', 'Coelemu', 'Ninhue', 'Portezuelo', 'Ránquil', 'Treguaco', 'San Carlos', 'Coihueco', 'Ñiquén', 'San Fabián', 'San Nicolás'] },
  { name: 'Biobío', communes: ['Concepción', 'Coronel', 'Chiguayante', 'Florida', 'Hualqui', 'Lota', 'Penco', 'San Pedro de la Paz', 'Santa Juana', 'Talcahuano', 'Tomé', 'Hualpén', 'Lebu', 'Arauco', 'Cañete', 'Contulmo', 'Curanilahue', 'Los Álamos', 'Tirúa', 'Los Ángeles', 'Antuco', 'Cabrero', 'Laja', 'Mulchén', 'Nacimiento', 'Negrete', 'Quilaco', 'Quilleco', 'San Rosendo', 'Santa Bárbara', 'Tucapel', 'Yumbel', 'Alto Biobío'] },
  { name: 'La Araucanía', communes: ['Temuco', 'Carahue', 'Cunco', 'Curarrehue', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Melipeuco', 'Nueva Imperial', 'Padre Las Casas', 'Perquenco', 'Pitrufquén', 'Pucón', 'Saavedra', 'Teodoro Schmidt', 'Toltén', 'Vilcún', 'Villarrica', 'Cholchol', 'Angol', 'Collipulli', 'Curacautín', 'Ercilla', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Purén', 'Renaico', 'Traiguén', 'Victoria'] },
  { name: 'Los Ríos', communes: ['Valdivia', 'Corral', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'La Unión', 'Futrono', 'Lago Ranco', 'Río Bueno'] },
  { name: 'Los Lagos', communes: ['Puerto Montt', 'Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Los Muermos', 'Llanquihue', 'Maullín', 'Puerto Varas', 'Castro', 'Ancud', 'Chonchi', 'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Juan de la Costa', 'San Pablo', 'Chaitén', 'Futaleufú', 'Hualaihué', 'Palena'] },
  { name: 'Aysén', communes: ['Coyhaique', 'Lago Verde', 'Aysén', 'Cisnes', 'Guaitecas', 'Cochrane', 'O’Higgins', 'Tortel', 'Chile Chico', 'Río Ibáñez'] },
  { name: 'Magallanes y la Antártica Chilena', communes: ['Punta Arenas', 'Laguna Blanca', 'Río Verde', 'San Gregorio', 'Cabo de Hornos', 'Antártica', 'Porvenir', 'Primavera', 'Timaukel', 'Natales', 'Torres del Paine'] },
];

router.get('/locations/regions', async (req, res) => {
  if (!ensureEndUser(req, res)) return;
  return res.json({ regions: chileRegions });
});

export default router;
