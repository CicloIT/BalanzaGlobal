import pool from '../config/database.js';

export const getProvincias = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM provincia ORDER BY nombre ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createProvincia = async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ success: false, error: 'Nombre es requerido' });

        const result = await pool.query(
            'INSERT INTO provincia (nombre) VALUES ($1) RETURNING *',
            [nombre]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateProvincia = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        const result = await pool.query(
            'UPDATE provincia SET nombre = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [nombre, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Provincia no encontrada' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteProvincia = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM provincia WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Provincia no encontrada' });
        res.json({ success: true, message: 'Provincia eliminada' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
