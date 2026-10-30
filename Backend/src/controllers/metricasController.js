import pool from '../config/database.js';
import { scopeSqlLiteral, userForRead, sendScopeError } from '../utils/scope.js';

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
             COALESCE(SUM(CASE WHEN tipo::text = 'TARA' THEN peso END), 0) as tara_total
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
        COALESCE(SUM(p.neto), 0) as peso_neto
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
        COALESCE(SUM(p.neto), 0) as peso_neto
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
        COALESCE(SUM(p.neto), 0) as peso_neto
      FROM pesada p
      JOIN vehiculo v ON p.vehiculo_patente = v.patente
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
        COALESCE(SUM(p.neto), 0) as peso_neto
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
        COALESCE(SUM(p.neto), 0) as peso_neto
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
        COALESCE(SUM(p.neto), 0) as total_neto_mes,
        COALESCE(AVG(p.neto) FILTER (WHERE p.neto > 0), 0) as carga_promedio
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
