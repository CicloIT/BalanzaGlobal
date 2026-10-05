import pool from '../config/database.js';

export const getLocalidades = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT l.*, p.nombre as provincia_nombre 
      FROM localidad l 
      LEFT JOIN provincia p ON l.provincia_id = p.id 
      ORDER BY l.nombre ASC
    `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createLocalidad = async (req, res) => {
    try {
        const { nombre, provincia_id } = req.body;
        if (!nombre) return res.status(400).json({ success: false, error: 'El nombre de la localidad es requerido' });
        if (!provincia_id) return res.status(400).json({ success: false, error: 'El ID de la provincia es requerido (debe ser un número)' });

        const result = await pool.query(
            'INSERT INTO localidad (nombre, provincia_id) VALUES ($1, $2) RETURNING *',
            [nombre, provincia_id]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateLocalidad = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, provincia_id } = req.body;
        const result = await pool.query(
            `UPDATE localidad SET 
       nombre = COALESCE($1, nombre), 
       provincia_id = COALESCE($2, provincia_id), 
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING *`,
            [nombre, provincia_id, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Localidad no encontrada' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteLocalidad = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM localidad WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Localidad no encontrada' });
        res.json({ success: true, message: 'Localidad eliminada' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
