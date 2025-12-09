import { pool } from '../config/db.js';

function httpError(status, error, extra = {}) {
  return { status, error, ...extra };
}

export async function getPlotTypes() {
  const { rows } = await pool.query(
    `SELECT id, code, name, default_capacity_spaces, description, created_at
     FROM cemetery_plot_types
     ORDER BY id ASC`
  );
  return rows;
}

async function validateSubsectorBelongsToSite(client, siteId, subsectorId) {
  const res = await client.query(
    `SELECT ss.id
     FROM cemetery_subsectors ss
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE ss.id = $1 AND a.site_id = $2`,
    [subsectorId, siteId]
  );
  return res.rowCount > 0;
}

async function validatePlotBelongsToSite(client, siteId, plotId) {
  const res = await client.query(
    `SELECT p.id
     FROM cemetery_plots p
     JOIN cemetery_subsectors ss ON ss.id = p.subsector_id
     JOIN cemetery_sectors s ON s.id = ss.sector_id
     JOIN cemetery_areas a ON a.id = s.area_id
     WHERE p.id = $1 AND a.site_id = $2`,
    [plotId, siteId]
  );
  return res.rowCount > 0;
}

export async function createPlot(siteId, subsectorId, data) {
  const subsector_id = Number(subsectorId);
  if (!Number.isInteger(subsector_id)) throw httpError(400, 'INVALID_SUBSECTOR_ID');

  const {
    plot_type_id,
    code,
    row_label = null,
    column_label = null,
    capacity_spaces = null,
    notes = null
  } = data || {};

  if (!plot_type_id || !code) {
    throw httpError(400, 'PLOT_TYPE_AND_CODE_REQUIRED');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate subsector within site
    const belongs = await validateSubsectorBelongsToSite(client, siteId, subsector_id);
    if (!belongs) throw httpError(404, 'SUBSECTOR_NOT_FOUND');

    // Validate plot type
    const ptRes = await client.query('SELECT id, default_capacity_spaces FROM cemetery_plot_types WHERE id = $1', [plot_type_id]);
    if (ptRes.rowCount === 0) throw httpError(400, 'PLOT_TYPE_NOT_FOUND');
    const defaultCapacity = ptRes.rows[0].default_capacity_spaces;

    let finalCapacity = Number(capacity_spaces);
    if (!Number.isInteger(finalCapacity) || finalCapacity <= 0) {
      finalCapacity = defaultCapacity > 0 ? defaultCapacity : 1;
    }

    // Insert plot
    const insPlot = await client.query(
      `INSERT INTO cemetery_plots (
         subsector_id, plot_type_id, code, row_label, column_label, capacity_spaces, is_active, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       RETURNING id, subsector_id, plot_type_id, code, row_label, column_label, capacity_spaces, is_active, notes, created_at`,
      [subsector_id, plot_type_id, code, row_label, column_label, finalCapacity, notes]
    );
    const plot = insPlot.rows[0];

    // Generate spaces
    for (let pos = 1; pos <= finalCapacity; pos += 1) {
      await client.query(
        `INSERT INTO cemetery_spaces (plot_id, position, status)
         VALUES ($1, $2, 'AVAILABLE')`,
        [plot.id, pos]
      );
    }

    await client.query('COMMIT');
    return plot;
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) throw err;
    console.error('createPlot error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}

export async function getPlotsBySubsector(siteId, subsectorId) {
  const subsector_id = Number(subsectorId);
  if (!Number.isInteger(subsector_id)) throw httpError(400, 'INVALID_SUBSECTOR_ID');

  const client = await pool.connect();
  try {
    // Validate belongs
    const belongs = await validateSubsectorBelongsToSite(client, siteId, subsector_id);
    if (!belongs) throw httpError(404, 'SUBSECTOR_NOT_FOUND');

    const { rows } = await client.query(
      `SELECT p.id, p.subsector_id, p.plot_type_id, t.code AS plot_type_code, t.name AS plot_type_name,
              p.code, p.row_label, p.column_label, p.capacity_spaces, p.is_active, p.notes, p.created_at
       FROM cemetery_plots p
       JOIN cemetery_plot_types t ON t.id = p.plot_type_id
       WHERE p.subsector_id = $1
       ORDER BY p.code ASC, p.id ASC`,
      [subsector_id]
    );
    return rows;
  } catch (err) {
    if (err.status) throw err;
    console.error('getPlotsBySubsector error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}

export async function deletePlot(siteId, plotId) {
  const pid = Number(plotId);
  if (!Number.isInteger(pid)) throw httpError(400, 'INVALID_PLOT_ID');
  const client = await pool.connect();
  try {
    const belongs = await validatePlotBelongsToSite(client, siteId, pid);
    if (!belongs) throw httpError(404, 'PLOT_NOT_FOUND');
    await client.query('DELETE FROM cemetery_plots WHERE id = $1', [pid]);
    return { deleted: true };
  } catch (err) {
    if (err.status) throw err;
    console.error('deletePlot error:', err);
    throw httpError(500, 'INTERNAL_ERROR');
  } finally {
    client.release();
  }
}
