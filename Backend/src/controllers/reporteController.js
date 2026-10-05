import pool from '../config/database.js';

// ─── POST /api/reportes ──────────────────────────────────────────────────────
// Body: { pesadas: [...], observaciones?: string }
// Recibe el array completo de pesadas ya resueltas desde el frontend
export const createReporte = async (req, res) => {
    try {
        const { pesadas, observaciones } = req.body;

        if (!pesadas || !Array.isArray(pesadas) || pesadas.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'pesadas es requerido y debe ser un array no vacío'
            });
        }

        const totalBruto = pesadas.reduce((acc, p) => acc + (Number(p.bruto) || 0), 0);
        const totalTara = pesadas.reduce((acc, p) => acc + (Number(p.tara) || 0), 0);
        const totalNeto = pesadas.reduce((acc, p) => acc + (Number(p.neto) || 0), 0);

        const localidadId = req.user?.localidad_id ?? null;
        const result = await pool.query(
            `INSERT INTO reporte (
        cantidad_pesadas, total_bruto, total_tara, total_neto,
        pesadas_data, observaciones, localidad_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
            [
                pesadas.length,
                totalBruto,
                totalTara,
                totalNeto,
                JSON.stringify(pesadas),
                observaciones || null,
                localidadId
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Reporte guardado exitosamente',
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ─── GET /api/reportes ───────────────────────────────────────────────────────
export const getReportes = async (req, res) => {
    try {
        const localidadId = req.user?.localidad_id ?? null;
        const result = await pool.query(`
      SELECT id, numero_reporte, cantidad_pesadas,
             total_bruto, total_tara, total_neto,
             observaciones, created_at
      FROM reporte
      WHERE ($1::int IS NULL OR localidad_id = $1)
      ORDER BY created_at DESC
      LIMIT 200
    `, [localidadId]);
        res.json({ success: true, data: result.rows, count: result.rows.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ─── GET /api/reportes/:id ───────────────────────────────────────────────────
// Devuelve el reporte completo con el snapshot de pesadas
export const getReporteById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM reporte WHERE id = $1`, [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Reporte no encontrado' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteReporte = async (req, res) => {
  try {
    let ids = [];

    // 👉 Caso 1: viene por params (uno solo)
    if (req.params.id) {
      ids = [parseInt(req.params.id)];
    }

    // 👉 Caso 2: vienen varios en el body
    if (Array.isArray(req.body.ids) && req.body.ids.length > 0) {
      ids = req.body.ids.map(id => parseInt(id));
    }

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionaron IDs'
      });
    }

    const result = await pool.query(
      `DELETE FROM reporte
       WHERE id = ANY($1::int[])
       RETURNING id`,
      [ids]
    );

    res.json({
      success: true,
      eliminados: result.rowCount,
      ids: result.rows.map(r => r.id)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};