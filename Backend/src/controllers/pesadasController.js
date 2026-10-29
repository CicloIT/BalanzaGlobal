import pool from '../config/database.js';
import { hasPermission, PERMISSIONS } from '../config/rolesConfig.js';
import { scopeSql, userForRead, ScopeError, sendScopeError } from '../utils/scope.js';
import { pesoLeidoRecientemente } from '../services/balanzaService.js';

// Una pesada no manual debe tener un peso que esa misma balanza haya marcado hace poco
const VALIDAR_PESO_BALANZA = process.env.VALIDAR_PESO_BALANZA !== 'false';
const PESO_MAX_EDAD_MS = parseInt(process.env.PESO_MAX_EDAD_MS, 10) || 60000;
const PESO_TOLERANCIA_KG = parseFloat(process.env.PESO_TOLERANCIA_KG) || 0;

// Subconsulta: operaciones dentro del alcance del usuario → `columna ${sql}`
const operacionesEnScope = (user, startIdx) => {
  const scope = scopeSql('op.localidad_id', user, startIdx);
  return { sql: `IN (SELECT op.id FROM operacion_pesaje op WHERE ${scope.sql})`, params: scope.params };
};

export const getPesadas = async (req, res) => {
  try {
    const scope = scopeSql('op.localidad_id', userForRead(req), 1);
    const result = await pool.query(`
      SELECT
        p.*,
        op.vehiculo_patente,
        op.abierta as operacion_abierta,
        c.apellido_nombre  AS chofer,
        prod.nombre        AS producto,
        ptr.nombre         AS productor,
        tr.nombre          AS transporte
      FROM pesada p
      JOIN operacion_pesaje op ON p.operacion_id = op.id
      LEFT JOIN chofer    c   ON p.chofer_id    = c.id
      LEFT JOIN producto  prod ON p.producto_id  = prod.id
      LEFT JOIN productor ptr  ON p.productor_id = ptr.id
      LEFT JOIN transporte tr  ON p.transporte_id = tr.id
      WHERE ${scope.sql}
      ORDER BY p.fecha_hora DESC
      LIMIT 200
    `, scope.params);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createPesada = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      vehiculo_patente, sentido, peso, chofer_id, productor_id,
      transporte_id, producto_id, balancero, nro_remito, es_manual, fotos,
      es_contenedor, nro_contenedor, peso_vgm, tara_contenedor,
      cantidad_bultos, nro_proforma, nro_permiso_embarque, dispositivo_id
    } = req.body;

    // Validaciones
    if (!vehiculo_patente || !sentido || !peso) {
      throw new ScopeError('Faltan campos requeridos (patente, sentido, peso)', 400);
    }
    if (!dispositivo_id) {
      throw new ScopeError('dispositivo_id es requerido (balanza de la localidad)', 400);
    }

    const esContenedor = es_contenedor === 'true' || es_contenedor === true;
    const nroContenedorFinal = esContenedor ? (nro_contenedor || '0') : null;

    if (!['INGRESO', 'SALIDA'].includes(sentido)) {
      throw new ScopeError('Sentido debe ser INGRESO o SALIDA', 400);
    }

    if (peso <= 0) {
      throw new ScopeError('El peso debe ser positivo', 400);
    }

    // Validación de permiso para carga manual
    const esManual = es_manual === 'true' || es_manual === true;
    if (esManual) {
      const userRol = req.user?.rol;
      if (!hasPermission(userRol, PERMISSIONS.PESAJE_MANUAL)) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'No tiene permiso para cargar peso manualmente.',
          code: 'MANUAL_WEIGHT_FORBIDDEN',
          requiredPermission: PERMISSIONS.PESAJE_MANUAL,
          currentRole: userRol
        });
      }
    }

    // La localidad de la operación es la de la balanza (validada contra el alcance del usuario)
    const scopeDisp = scopeSql('localidad_id', req.user, 2);
    const dispResult = await client.query(
      `SELECT id, localidad_id FROM configuracion_dispositivos
       WHERE id = $1 AND tipo_dispositivo = 'balanza' AND ${scopeDisp.sql}`,
      [dispositivo_id, ...scopeDisp.params]
    );
    if (dispResult.rows.length === 0) {
      throw new ScopeError('La balanza indicada no pertenece a su localidad');
    }
    const localidadId = dispResult.rows[0].localidad_id;

    // Los catálogos referenciados deben ser de la misma localidad
    const referencias = [
      ['chofer', chofer_id], ['productor', productor_id],
      ['transporte', transporte_id], ['producto', producto_id],
    ];
    for (const [tabla, refId] of referencias) {
      if (!refId) continue;
      const ref = await client.query(`SELECT 1 FROM ${tabla} WHERE id = $1 AND localidad_id = $2`, [refId, localidadId]);
      if (ref.rows.length === 0) throw new ScopeError(`El ${tabla} no pertenece a la localidad de la balanza`, 400);
    }

    if (!esManual && VALIDAR_PESO_BALANZA &&
        !pesoLeidoRecientemente(dispositivo_id, Number(peso), { maxEdadMs: PESO_MAX_EDAD_MS, toleranciaKg: PESO_TOLERANCIA_KG })) {
      throw new ScopeError(
        `La balanza no marcó ${peso} kg en los últimos ${Math.round(PESO_MAX_EDAD_MS / 1000)} s. Vuelva a capturar el peso o cárguelo como manual.`,
        409
      );
    }

    // Buscar operación abierta
    let operacionResult = await client.query(
      'SELECT id, sentido FROM operacion_pesaje WHERE vehiculo_patente = $1 AND abierta = true AND localidad_id = $2',
      [vehiculo_patente, localidadId]
    );

    let operacion_id;
    let tipo;

    if (operacionResult.rows.length === 0) {
      // Nueva operación: tipo determinado por sentido
      tipo = sentido === 'INGRESO' ? 'BRUTO' : 'TARA';
      const newOp= await client.query(
        'INSERT INTO operacion_pesaje (vehiculo_patente, sentido, localidad_id) VALUES ($1, $2, $3) RETURNING id',
        [vehiculo_patente, sentido, localidadId]
      );
      operacion_id = newOp.rows[0].id;
    } else {
      operacion_id = operacionResult.rows[0].id;

      // Determinar tipo faltante (opuesto al que ya existe)
      const pesadaExist = await client.query(
        'SELECT tipo FROM pesada WHERE operacion_id = $1',
        [operacion_id]
      );
      if (pesadaExist.rows.length === 0) {
        tipo = sentido === 'INGRESO' ? 'BRUTO' : 'TARA';
      } else {
        const tiposExistentes = pesadaExist.rows.map(r => r.tipo);
        if (tiposExistentes.includes('BRUTO') && tiposExistentes.includes('TARA')) {
          throw new Error('Esta operación ya tiene ambas pesadas registradas');
        }
        tipo = tiposExistentes.includes('BRUTO') ? 'TARA' : 'BRUTO';
      }
    }

    const result = await client.query(
      `INSERT INTO pesada (
        operacion_id, tipo, peso, chofer_id, productor_id,
        transporte_id, producto_id, vehiculo_patente, balancero, nro_remito, ruta, fotos,
        es_contenedor, nro_contenedor, peso_vgm, tara_contenedor,
        cantidad_bultos, nro_proforma, nro_permiso_embarque, dispositivo_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        operacion_id, tipo, peso,
        chofer_id || null, productor_id || null,
        transporte_id || null, producto_id || null,
        vehiculo_patente, balancero || null,
        nro_remito || null,
        req.file ? `documentos/${req.file.filename}` : null,
        fotos ? (typeof fotos === 'string' ? fotos : JSON.stringify(fotos)) : null,
        esContenedor,
        nroContenedorFinal,
        esContenedor ? (peso_vgm || null) : null,
        esContenedor ? (tara_contenedor || null) : null,
        esContenedor ? (cantidad_bultos || null) : null,
        esContenedor ? (nro_proforma || null) : null,
        esContenedor ? (nro_permiso_embarque || null) : null,
        dispositivo_id
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Pesada registrada exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    sendScopeError(res, error);
  } finally {
    client.release();
  }
};

export const getPesadaById= async (req, res) => {
  try {
    const scope = operacionesEnScope(req.user, 2);
    const result = await pool.query(
      `SELECT * FROM pesada WHERE id = $1 AND operacion_id ${scope.sql}`,
      [req.params.id, ...scope.params]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pesada no encontrada' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePesada = async (req, res) => {
  try {
    const { id } = req.params;
    const { peso, balancero } = req.body;

    if (peso && peso <= 0) {
      return res.status(400).json({ success: false, error: 'El peso debe ser positivo' });
    }

    // Corregir el peso de una pesada ya registrada es distinto de cargar peso manual al pesar:
    // solo el superadmin (pesaje:editar_peso)
    if (peso !== undefined && peso !== null) {
      const userRol = req.user?.rol;
      if (!hasPermission(userRol, PERMISSIONS.PESAJE_EDITAR_PESO)) {
        return res.status(403).json({
          success: false,
          error: 'No tiene permiso para modificar el peso de una pesada registrada.',
          code: 'MANUAL_WEIGHT_FORBIDDEN',
          requiredPermission: PERMISSIONS.PESAJE_EDITAR_PESO,
          currentRole: userRol
        });
      }
    }

    const scope = operacionesEnScope(req.user, 5);
    const result = await pool.query(
      `UPDATE pesada SET
       peso = COALESCE($1, peso),
       balancero = COALESCE($2, balancero),
       ruta = COALESCE($3, ruta)
       WHERE id = $4 AND operacion_id ${scope.sql} RETURNING *`,
      [peso, balancero, req.file ? `documentos/${req.file.filename}` : null, id, ...scope.params]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pesada no encontrada' });
    }

    res.json({
      success: true,
      message: 'Pesada actualizada exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePdfByOperacion = async (req, res) => {
  try {
    const { operacionId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se envió ningún archivo PDF' });
    }

    const scope = operacionesEnScope(req.user, 3);
    const result = await pool.query(
      `UPDATE pesada SET
       ruta = $1
       WHERE operacion_id = $2 AND operacion_id ${scope.sql} RETURNING *`,
      [`documentos/${req.file.filename}`, operacionId, ...scope.params]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No se encontraron pesadas para esta operación' });
    }

    res.json({
      success: true,
      message: 'PDF asociado a la operación exitosamente',
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deletePesada = async (req, res) => {
   try {
    const { operacionId: id } = req.params;

    const scope = scopeSql('op.localidad_id', req.user, 2);
    const result = await pool.query(
      `DELETE FROM operacion_pesaje op WHERE op.id = $1 AND ${scope.sql} RETURNING *`,
      [id, ...scope.params]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Operación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Operación eliminada correctamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const deleteOperacionesMasivo = async (req, res) => {
  try {
    const { ids } = req.body; // array

    const scope = scopeSql('op.localidad_id', req.user, 2);
    const result = await pool.query(
      `DELETE FROM operacion_pesaje op WHERE op.id = ANY($1) AND ${scope.sql}`,
      [ids, ...scope.params]
    );

    res.json({
      success: true,
      message: 'Operaciones eliminadas',
      eliminadas: result.rowCount
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getPesadasAgrupadas = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? 20, 10), 100);
    const page = Math.max(parseInt(req.query.page ?? 1, 10), 1);
    const offset = (page - 1) * limit;
    const sentidoFilter = req.query.sentido;
    const fechaFilter = req.query.fecha;
    const mesParam = parseInt(req.query.mes, 10);
    const anioParam = parseInt(req.query.anio, 10);

    // Alcance empresa/localidad (por la localidad de la operación)
    const scope = scopeSql('op.localidad_id', userForRead(req), 1);
    const conditions = [scope.sql];
    const filterParams = [...scope.params];

    if (sentidoFilter && ['INGRESO', 'SALIDA'].includes(sentidoFilter)) {
      filterParams.push(sentidoFilter);
      conditions.push(`op.sentido = $${filterParams.length}`);
    }

    // Filtro específico mes+año tiene prioridad sobre fecha rápida
    if (!isNaN(anioParam) && !isNaN(mesParam)) {
      filterParams.push(anioParam);
      conditions.push(`EXTRACT(YEAR FROM op.created_at) = $${filterParams.length}`);
      filterParams.push(mesParam);
      conditions.push(`EXTRACT(MONTH FROM op.created_at) = $${filterParams.length}`);
    } else if (!isNaN(anioParam)) {
      filterParams.push(anioParam);
      conditions.push(`EXTRACT(YEAR FROM op.created_at) = $${filterParams.length}`);
    } else if (!isNaN(mesParam)) {
      filterParams.push(mesParam);
      conditions.push(`EXTRACT(MONTH FROM op.created_at) = $${filterParams.length}`);
    } else if (fechaFilter === 'hoy') {
      conditions.push(`DATE(op.created_at) = CURRENT_DATE`);
    } else if (fechaFilter === 'mes') {
      conditions.push(`DATE_TRUNC('month', op.created_at) = DATE_TRUNC('month', CURRENT_DATE)`);
    } else if (fechaFilter === 'anio') {
      conditions.push(`EXTRACT(YEAR FROM op.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT op.id) FROM operacion_pesaje op ${whereClause}`,
      filterParams
    );
    const total = parseInt(countResult.rows[0].count, 10);


    const mainParams = [...filterParams, limit, offset];
    const limitIdx = mainParams.length - 1;
    const offsetIdx = mainParams.length;

    const result = await pool.query(`
      SELECT op.id as id, op.id as operacion_id, op.vehiculo_patente,
             op.sentido, op.localidad_id, MAX(loc.nombre) as localidad_nombre,
             MAX(CASE WHEN p.tipo::text = 'BRUTO' THEN p.peso END) as bruto,
             MAX(CASE WHEN p.tipo::text = 'TARA'  THEN p.peso END) as tara,
             MAX(p.neto) as neto,
             MIN(p.fecha_hora) as fecha_entrada,
             MAX(p.fecha_hora) as fecha_salida,
             op.abierta,
             MAX(c.apellido_nombre) as chofer,
             MAX(prod.nombre)       as producto,
             MAX(ptr.nombre)        as productor,
             MAX(tr.nombre)         as transporte,
             MAX(p.balancero)       as balancero,
             MAX(p.nro_remito)      as nro_remito,
             MAX(p.ruta)            as ruta,
             jsonb_agg(p.fotos) filter (where p.fotos is not null) as todas_fotos,
             BOOL_OR(p.es_contenedor)           as es_contenedor,
             MAX(p.nro_contenedor)              as nro_contenedor,
             MAX(p.peso_vgm)                    as peso_vgm,
             MAX(p.tara_contenedor)             as tara_contenedor,
             MAX(p.cantidad_bultos)             as cantidad_bultos,
             MAX(p.nro_proforma)                as nro_proforma,
             MAX(p.nro_permiso_embarque)        as nro_permiso_embarque
      FROM operacion_pesaje op
      LEFT JOIN pesada    p    ON op.id = p.operacion_id
      LEFT JOIN localidad loc  ON op.localidad_id = loc.id
      LEFT JOIN chofer    c    ON p.chofer_id    = c.id
      LEFT JOIN producto  prod ON p.producto_id  = prod.id
      LEFT JOIN productor ptr  ON p.productor_id = ptr.id
      LEFT JOIN transporte tr  ON p.transporte_id = tr.id
      ${whereClause}
      GROUP BY op.id, op.vehiculo_patente, op.abierta, op.sentido, op.localidad_id
      ORDER BY op.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, mainParams);

    const hasMore = (result.rows.length === limit) && (offset + result.rows.length < total);


    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      total,
      page,
      limit,
      hasMore,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateContenedorByOperacion = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { operacionId } = req.params;
    const { nro_contenedor, peso_vgm, tara_contenedor, cantidad_bultos, nro_proforma, nro_permiso_embarque } = req.body;

    if (!nro_contenedor) {
      throw new ScopeError('Nro de contenedor es obligatorio', 400);
    }

    const scope = scopeSql('op.localidad_id', req.user, 2);
    const opResult = await client.query(
      `SELECT 1 FROM operacion_pesaje op WHERE op.id = $1 AND ${scope.sql}`,
      [operacionId, ...scope.params]
    );
    if (opResult.rows.length === 0) {
      throw new ScopeError('Operación no encontrada', 404);
    }

    // Traer bruto y tara actuales para recalcular
    const pesadasResult = await client.query(
      `SELECT tipo, peso FROM pesada WHERE operacion_id = $1`,
      [operacionId]
    );

    const brutoRec = pesadasResult.rows.find(r => r.tipo === 'BRUTO');
    const taraRec  = pesadasResult.rows.find(r => r.tipo === 'TARA');

    // Actualizar campos contenedor en todas las pesadas de la operación
    await client.query(
      `UPDATE pesada SET
        nro_contenedor       = $1,
        peso_vgm             = $2,
        tara_contenedor      = $3,
        cantidad_bultos      = $4,
        nro_proforma         = $5,
        nro_permiso_embarque = $6,
        es_contenedor        = true
       WHERE operacion_id = $7`,
      [
        nro_contenedor,
        peso_vgm          || null,
        tara_contenedor   || null,
        cantidad_bultos   || null,
        nro_proforma      || null,
        nro_permiso_embarque || null,
        operacionId
      ]
    );

    // Recalcular bruto/tara solo si operación cerrada y tara_contenedor válida
    const taraCont = parseFloat(tara_contenedor) || 0;
    if (brutoRec && taraRec && taraCont > 0) {
      const netoOriginal = parseFloat(brutoRec.peso) - parseFloat(taraRec.peso);
      const newBruto = netoOriginal + taraCont;
      const newTara  = taraCont;

      await client.query(
        `UPDATE pesada SET peso = $1 WHERE operacion_id = $2 AND tipo = 'BRUTO'`,
        [newBruto, operacionId]
      );
      await client.query(
        `UPDATE pesada SET peso = $1 WHERE operacion_id = $2 AND tipo = 'TARA'`,
        [newTara, operacionId]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Datos de contenedor actualizados exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    sendScopeError(res, error);
  } finally {
    client.release();
  }
};

export const getPesadaActivaByPatente = async (req, res) => {
  try {
    const { patente } = req.params;
    const scope = scopeSql('op.localidad_id', userForRead(req), 2);
    const result = await pool.query(`
      SELECT
        p.*,
        op.sentido,
        c.apellido_nombre  AS chofer_nombre,
        prod.nombre        AS producto_nombre,
        ptr.nombre         AS productor_nombre,
        tr.nombre          AS transporte_nombre
      FROM pesada p
      JOIN operacion_pesaje op ON p.operacion_id = op.id
      LEFT JOIN chofer    c   ON p.chofer_id    = c.id
      LEFT JOIN producto  prod ON p.producto_id  = prod.id
      LEFT JOIN productor ptr  ON p.productor_id = ptr.id
      LEFT JOIN transporte tr  ON p.transporte_id = tr.id
      WHERE op.vehiculo_patente = $1
        AND op.abierta = true
        AND ${scope.sql}
      ORDER BY p.fecha_hora DESC
      LIMIT 1
    `, [patente, ...scope.params]);

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
