import pool from '../config/database.js';

export const getUsuarios = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.rol, u.localidad_id, l.nombre as localidad_nombre, u.activo, u.created_at
      FROM usuario u
      LEFT JOIN localidad l ON u.localidad_id = l.id
      WHERE u.activo = true
      ORDER BY u.username ASC
    `);
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getUsuarioById = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, l.nombre as localidad_nombre
      FROM usuario u
      LEFT JOIN localidad l ON u.localidad_id = l.id
      WHERE u.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createUsuario = async (req, res) => {
  try {
    const { username, password_hash, rol, localidad_id } = req.body;
    if (!username || !password_hash) {
      return res.status(400).json({ success: false, error: 'Username y password son requeridos' });
    }
    const result = await pool.query(
      'INSERT INTO usuario (username, password_hash, rol, localidad_id, activo) VALUES ($1, $2, $3, $4, true) RETURNING id, username, rol, localidad_id',
      [username, password_hash, rol || 'empleado', localidad_id || null]
    );
    res.status(201).json({ success: true, message: 'Usuario creado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol, localidad_id, activo } = req.body;
    const result = await pool.query(
      `UPDATE usuario SET 
       rol = COALESCE($1, rol),
       localidad_id = COALESCE($2, localidad_id),
       activo = COALESCE($3, activo), 
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING id, username, rol, localidad_id, activo`,
      [rol, localidad_id, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, message: 'Usuario actualizado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteUsuario = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE usuario SET activo = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, username, rol`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    res.json({ success: true, message: 'Usuario eliminado', data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Login ──────────────────────────────────────────────────────────────────────
export const authLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Usuario y contraseña son requeridos' });
    }
    const result = await pool.query(
      `SELECT u.id, u.username, u.rol, u.localidad_id, l.nombre as localidad_nombre
       FROM usuario u
       LEFT JOIN localidad l ON u.localidad_id = l.id
       WHERE LOWER(u.username) = LOWER($1) AND u.password_hash = $2 AND u.activo = true`,
      [username.trim(), password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
