import pool from '../config/database.js';

export const getEmpresas = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT e.*, (SELECT COUNT(*) FROM localidad l WHERE l.empresa_id = e.id)::int AS cantidad_localidades
      FROM empresa e
      ORDER BY e.nombre ASC
    `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createEmpresa = async (req, res) => {
    const client = await pool.connect();
    try {
        const { nombre, cuit } = req.body;
        if (!nombre) return res.status(400).json({ success: false, error: 'El nombre de la empresa es requerido' });

        await client.query('BEGIN');
        const result = await client.query(
            'INSERT INTO empresa (nombre, cuit) VALUES ($1, $2) RETURNING *',
            [nombre, cuit || null]
        );
        await client.query('INSERT INTO empresa_config (empresa_id) VALUES ($1)', [result.rows[0].id]);
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

export const updateEmpresa = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, cuit, activo } = req.body;
        const result = await pool.query(
            `UPDATE empresa SET
       nombre = COALESCE($1, nombre),
       cuit = COALESCE($2, cuit),
       activo = COALESCE($3, activo),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
            [nombre, cuit, activo, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Baja lógica: una empresa con localidades no se borra físicamente
export const deleteEmpresa = async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE empresa SET activo = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });
        res.json({ success: true, message: 'Empresa desactivada', data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/empresas/actual/config — configuración visual/funcional de la empresa del usuario
export const getConfigEmpresaActual = async (req, res) => {
    try {
        const empresaId = req.user?.empresa_id ?? (req.query.empresa_id ? parseInt(req.query.empresa_id, 10) : null);
        if (!empresaId) return res.json({ success: true, data: null });
        const result = await pool.query(`
      SELECT e.id AS empresa_id, e.nombre, ec.nombre_fantasia, ec.logo_url, ec.color_primario, ec.modulos, ec.parametros
      FROM empresa e
      LEFT JOIN empresa_config ec ON ec.empresa_id = e.id
      WHERE e.id = $1
    `, [empresaId]);
        res.json({ success: true, data: result.rows[0] || null });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
