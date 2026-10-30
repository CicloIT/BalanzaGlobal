import pool from '../config/database.js';
import { scopeSqlLiteral, userForRead, sendScopeError } from '../utils/scope.js';
import { getEstadoBalanza } from '../services/balanzaService.js';

// El trigger calcular_neto guarda el neto en las DOS pesadas de una operación cerrada:
// para no contarlo doble, los totales de neto suman solo la pesada TARA (una por operación).

// Pesadas dentro del alcance: por la localidad de su operación
const filtroPesadas = (user) =>
  `AND p.operacion_id IN (SELECT id FROM operacion_pesaje WHERE ${scopeSqlLiteral('localidad_id', user)})`;

export const getMetricasDashboard = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Alcance empresa/localidad (un usuario global puede acotar con ?localidad_id=)
    const usuario = userForRead(req);
    const localidadFiltroDisp = filtroPesadas(usuario);
    const localidadFiltroOp = `AND ${scopeSqlLiteral('localidad_id', usuario)}`;

    // 1. Total de pesadas hoy
    const pesadasHoy = await pool.query(`
      SELECT COUNT(*) as total,
             COALESCE(SUM(CASE WHEN tipo::text = 'BRUTO' THEN peso END), 0) as bruto_total,
             COALESCE(SUM(CASE WHEN tipo::text = 'TARA' THEN peso END), 0) as tara_total,
             COALESCE(SUM(neto) FILTER (WHERE tipo::text = 'TARA'), 0) as neto_total
      FROM pesada p
      WHERE DATE(fecha_hora) = CURRENT_DATE
      ${localidadFiltroDisp}
    `);

    // 2. Operaciones del día
    const operacionesHoy = await pool.query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN abierta = true THEN 1 ELSE 0 END) as abiertas
      FROM operacion_pesaje
      WHERE DATE(created_at) = CURRENT_DATE
      ${localidadFiltroOp}
    `);

    // 3. Pesadas de la semana por día (Últimos 7 días reales)
    const pesadasSemana = await pool.query(`
      SELECT
        DATE(fecha_hora) as fecha,
        COUNT(*) as total_pesadas,
        COALESCE(SUM(CASE WHEN tipo::text = 'BRUTO' THEN peso END), 0) as bruto,
        COALESCE(SUM(CASE WHEN tipo::text = 'TARA' THEN peso END), 0) as tara
      FROM pesada p
      WHERE fecha_hora >= CURRENT_DATE - INTERVAL '7 days'
      ${localidadFiltroDisp}
      GROUP BY DATE(fecha_hora)
      ORDER BY fecha ASC
    `);

    // 4. Top 5 productores por peso neto
    const topProductores = await pool.query(`
      SELECT
        pr.codigo,
        pr.nombre,
        COUNT(DISTINCT p.operacion_id) as operaciones,
        COALESCE(SUM(p.neto) FILTER (WHERE p.tipo::text = 'TARA'), 0) as peso_neto
      FROM pesada p
      JOIN productor pr ON p.productor_id = pr.id
      WHERE p.fecha_hora >= $1
      ${localidadFiltroDisp}
      GROUP BY pr.id, pr.codigo, pr.nombre
      ORDER BY peso_neto DESC
      LIMIT 5
    `, [inicioMes]);

    // 5. Top 5 productos movidos
    const topProductos = await pool.query(`
      SELECT
        pr.codigo,
        pr.nombre,
        COUNT(*) as total_pesadas,
        COALESCE(SUM(p.neto) FILTER (WHERE p.tipo::text = 'TARA'), 0) as peso_neto
      FROM pesada p
      JOIN producto pr ON p.producto_id = pr.id
      WHERE p.fecha_hora >= $1
      ${localidadFiltroDisp}
      GROUP BY pr.id, pr.codigo, pr.nombre
      ORDER BY peso_neto DESC
      LIMIT 5
    `, [inicioMes]);

    // 6. Distribución por tipo de vehículo
    const distribucionVehiculos = await pool.query(`
      SELECT
        v.tipo_vehiculo,
        COUNT(DISTINCT p.operacion_id) as operaciones,
        COALESCE(SUM(p.neto) FILTER (WHERE p.tipo::text = 'TARA'), 0) as peso_neto
      FROM pesada p
      JOIN operacion_pesaje op ON op.id = p.operacion_id
      JOIN vehiculo v ON v.patente = p.vehiculo_patente AND v.localidad_id = op.localidad_id
      WHERE p.fecha_hora >= $1
      ${localidadFiltroDisp}
      GROUP BY v.tipo_vehiculo
      ORDER BY peso_neto DESC
    `, [inicioMes]);

    // 7. Top 5 Transportes
    const topTransportes = await pool.query(`
      SELECT
        t.nombre,
        t.cuit,
        COUNT(DISTINCT p.operacion_id) as operaciones,
        COALESCE(SUM(p.neto) FILTER (WHERE p.tipo::text = 'TARA'), 0) as peso_neto
      FROM pesada p
      JOIN transporte t ON p.transporte_id = t.id
      WHERE p.fecha_hora >= $1
      ${localidadFiltroDisp}
      GROUP BY t.id, t.nombre, t.cuit
      ORDER BY peso_neto DESC
      LIMIT 5
    `, [inicioMes]);

    // 8. Top 5 Choferes
    const topChoferes = await pool.query(`
      SELECT
        c.apellido_nombre as nombre,
        COUNT(DISTINCT p.operacion_id) as operaciones,
        COALESCE(SUM(p.neto) FILTER (WHERE p.tipo::text = 'TARA'), 0) as peso_neto
      FROM pesada p
      JOIN chofer c ON p.chofer_id = c.id
      WHERE p.fecha_hora >= $1
      ${localidadFiltroDisp}
      GROUP BY c.id, c.apellido_nombre
      ORDER BY operaciones DESC
      LIMIT 5
    `, [inicioMes]);

    // 9. Estadísticas generales
    const estadisticasGenerales = await pool.query(`
      SELECT
        COUNT(DISTINCT p.id) as total_pesadas_mes,
        COUNT(DISTINCT p.operacion_id) as total_operaciones_mes,
        COALESCE(SUM(p.neto) FILTER (WHERE p.tipo::text = 'TARA'), 0) as total_neto_mes,
        COALESCE(AVG(p.neto) FILTER (WHERE p.tipo::text = 'TARA' AND p.neto > 0), 0) as carga_promedio
      FROM pesada p
      WHERE p.fecha_hora >= $1
      ${localidadFiltroDisp}
    `, [inicioMes]);

    // 12. Actividad por hora (últimos 7 días)
    const actividadPorHora = await pool.query(`
      SELECT
        EXTRACT(DOW FROM fecha_hora) as dia_semana,
        EXTRACT(HOUR FROM fecha_hora) as hora,
        COUNT(*) as total
      FROM pesada p
      WHERE fecha_hora >= CURRENT_DATE - INTERVAL '7 days'
      ${localidadFiltroDisp}
      GROUP BY dia_semana, hora
      ORDER BY dia_semana, hora
    `);

    // 13. Índice de eficiencia
    const eficienciaResult = await pool.query(`
      SELECT
        COALESCE(AVG(duracion_minutos), 0) as promedio_minutos
      FROM (
        SELECT
          EXTRACT(EPOCH FROM (MAX(fecha_hora) - MIN(fecha_hora))) / 60 as duracion_minutos
        FROM pesada p
        WHERE fecha_hora >= $1
        ${localidadFiltroDisp}
        GROUP BY operacion_id
        HAVING COUNT(*) > 1
      ) sub
    `, [inicioMes]);

    res.json({
      success: true,
      data: {
        hoy: {
          pesadas: parseInt(pesadasHoy.rows[0]?.total || 0),
          bruto: parseFloat(pesadasHoy.rows[0]?.bruto_total || 0),
          tara: parseFloat(pesadasHoy.rows[0]?.tara_total || 0),
          neto: parseFloat(pesadasHoy.rows[0]?.neto_total || 0),
          operaciones: parseInt(operacionesHoy.rows[0]?.total || 0),
          operacionesAbiertas: parseInt(operacionesHoy.rows[0]?.abiertas || 0),
        },
        semana: pesadasSemana.rows.map(row => ({
          fecha: row.fecha,
          total: parseInt(row.total_pesadas),
          bruto: parseFloat(row.bruto),
          tara: parseFloat(row.tara),
          neto: parseFloat(row.bruto) - parseFloat(row.tara)
        })),
        topProductores: topProductores.rows.map(row => ({
          codigo: row.codigo,
          nombre: row.nombre,
          operaciones: parseInt(row.operaciones),
          pesoNeto: parseFloat(row.peso_neto)
        })),
        topProductos: topProductos.rows.map(row => ({
          codigo: row.codigo,
          nombre: row.nombre,
          totalPesadas: parseInt(row.total_pesadas),
          pesoNeto: parseFloat(row.peso_neto)
        })),
        topTransportes: topTransportes.rows.map(row => ({
          nombre: row.nombre,
          cuit: row.cuit,
          operaciones: parseInt(row.operaciones),
          pesoNeto: parseFloat(row.peso_neto)
        })),
        topChoferes: topChoferes.rows.map(row => ({
          nombre: row.nombre,
          operaciones: parseInt(row.operaciones),
          pesoNeto: parseFloat(row.peso_neto)
        })),
        distribucionVehiculos: distribucionVehiculos.rows.map(row => ({
          tipo: row.tipo_vehiculo,
          operaciones: parseInt(row.operaciones),
          pesoNeto: parseFloat(row.peso_neto)
        })),
        actividadHeatmap: actividadPorHora.rows.map(row => ({
          dia: parseInt(row.dia_semana),
          hora: parseInt(row.hora),
          total: parseInt(row.total)
        })),
        eficiencia: {
          promedioMinutos: Math.round(parseFloat(eficienciaResult.rows[0]?.promedio_minutos || 0))
        },
        estadisticasMes: {
          totalPesadas: parseInt(estadisticasGenerales.rows[0]?.total_pesadas_mes || 0),
          totalOperaciones: parseInt(estadisticasGenerales.rows[0]?.total_operaciones_mes || 0),
          totalNeto: parseFloat(estadisticasGenerales.rows[0]?.total_neto_mes || 0),
          cargaPromedio: parseFloat(estadisticasGenerales.rows[0]?.carga_promedio || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error en getMetricasDashboard:', error);
    sendScopeError(res, error);
  }
};

// GET /api/metricas/en-vivo — qué está pasando ahora en cada localidad del alcance:
// balanza (peso actual), operaciones abiertas (camión con bruto esperando la tara), totales de hoy y últimas pesadas
export const getEnVivo = async (req, res) => {
  try {
    const usuario = userForRead(req);
    const scopeLoc = scopeSqlLiteral('l.id', usuario);
    const scopeOp = scopeSqlLiteral('op.localidad_id', usuario);

    const [localidades, balanzas, abiertas, hoy, ultimas] = await Promise.all([
      pool.query(`SELECT l.id, l.nombre FROM localidad l WHERE ${scopeLoc} ORDER BY l.nombre`),
      pool.query(`
        SELECT cd.id, cd.localidad_id FROM configuracion_dispositivos cd
        JOIN localidad l ON l.id = cd.localidad_id
        WHERE cd.tipo_dispositivo = 'balanza' AND cd.activo = true AND ${scopeLoc}
        ORDER BY cd.id
      `),
      pool.query(`
        SELECT op.id, op.localidad_id, op.vehiculo_patente, op.sentido, op.created_at,
               p.peso AS bruto, ch.apellido_nombre AS chofer, pr.nombre AS producto
        FROM operacion_pesaje op
        LEFT JOIN LATERAL (SELECT * FROM pesada WHERE operacion_id = op.id ORDER BY fecha_hora LIMIT 1) p ON true
        LEFT JOIN chofer ch ON ch.id = p.chofer_id
        LEFT JOIN producto pr ON pr.id = p.producto_id
        WHERE op.abierta = true AND ${scopeOp}
        ORDER BY op.created_at
      `),
      pool.query(`
        SELECT op.localidad_id, COUNT(*)::int AS pesadas,
               COALESCE(SUM(p.neto) FILTER (WHERE p.tipo::text = 'TARA'), 0) AS neto
        FROM pesada p JOIN operacion_pesaje op ON op.id = p.operacion_id
        WHERE DATE(p.fecha_hora) = CURRENT_DATE AND ${scopeOp}
        GROUP BY op.localidad_id
      `),
      pool.query(`
        SELECT p.id, p.tipo::text AS tipo, p.peso, p.neto, p.fecha_hora, p.vehiculo_patente, p.balancero,
               op.localidad_id, op.sentido, ch.apellido_nombre AS chofer, pr.nombre AS producto
        FROM pesada p
        JOIN operacion_pesaje op ON op.id = p.operacion_id
        LEFT JOIN chofer ch ON ch.id = p.chofer_id
        LEFT JOIN producto pr ON pr.id = p.producto_id
        WHERE ${scopeOp}
        ORDER BY p.fecha_hora DESC
        LIMIT 15
      `),
    ]);

    const hoyPorLoc = new Map(hoy.rows.map(r => [r.localidad_id, r]));
    res.json({
      success: true,
      data: {
        localidades: localidades.rows.map(l => {
          const h = hoyPorLoc.get(l.id);
          return {
            id: l.id,
            nombre: l.nombre,
            balanzas: balanzas.rows.filter(b => b.localidad_id === l.id).map(b => {
              const e = getEstadoBalanza(b.id);
              return {
                dispositivo_id: b.id,
                connected: Boolean(e?.connected),
                peso: e?.lastWeight ?? null,
                stable: Boolean(e?.stable),
                ts: e?.lastWeightTs ?? null,
              };
            }),
            abiertas: abiertas.rows.filter(o => o.localidad_id === l.id).map(o => ({
              id: o.id, patente: o.vehiculo_patente, sentido: o.sentido, desde: o.created_at,
              bruto: o.bruto != null ? parseFloat(o.bruto) : null, chofer: o.chofer, producto: o.producto,
            })),
            hoy: {
              pesadas: h?.pesadas ?? 0,
              neto: h ? parseFloat(h.neto) : 0,
            },
          };
        }),
        ultimas: ultimas.rows.map(p => ({
          ...p,
          peso: parseFloat(p.peso),
          neto: p.neto != null ? parseFloat(p.neto) : null,
        })),
      },
    });
  } catch (error) {
    sendScopeError(res, error);
  }
};
