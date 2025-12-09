import { pool } from '../config/db.js';

function httpError(status, error) {
  return { status, error };
}

export async function getCemeteryDashboard(siteId) {
  const client = await pool.connect();
  try {
    const areasRes = await client.query('SELECT COUNT(*)::int AS count FROM cemetery_areas WHERE site_id = $1', [siteId]);

    const sectorsRes = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM cemetery_sectors s
       JOIN cemetery_areas a ON a.id = s.area_id
       WHERE a.site_id = $1`,
      [siteId]
    );

    const subsectorsRes = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM cemetery_subsectors ss
       JOIN cemetery_sectors s ON s.id = ss.sector_id
       JOIN cemetery_areas a ON a.id = s.area_id
       WHERE a.site_id = $1`,
      [siteId]
    );

    const plotsRes = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM cemetery_plots p
       JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
       JOIN cemetery_sectors s ON s.id = ss.sector_id
       JOIN cemetery_areas a ON a.id = s.area_id
       WHERE a.site_id = $1`,
      [siteId]
    );

    const spacesRes = await client.query(
      `SELECT sp.status, COUNT(*)::int AS count
       FROM cemetery_spaces sp
       JOIN cemetery_plots p ON p.id = sp.plot_id
       JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
       JOIN cemetery_sectors s ON s.id = ss.sector_id
       JOIN cemetery_areas a ON a.id = s.area_id
       WHERE a.site_id = $1
       GROUP BY sp.status`,
      [siteId]
    );

    const spaces = {
      available: 0,
      reserved: 0,
      occupied: 0,
      locked: 0
    };
    for (const row of spacesRes.rows) {
      const key = row.status.toLowerCase();
      if (spaces[key] !== undefined) spaces[key] = row.count;
    }

    return {
      areas: areasRes.rows[0]?.count || 0,
      sectors: sectorsRes.rows[0]?.count || 0,
      subsectors: subsectorsRes.rows[0]?.count || 0,
      plots: plotsRes.rows[0]?.count || 0,
      spaces
    };
  } catch (err) {
    console.error('getCemeteryDashboard error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}
