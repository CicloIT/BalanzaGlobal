import pool from '../config/database.js';

export const getMetricasDashboard = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - 7); // Últimos 7 días en lugar de inicio de semana
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const localidadId = req.user?.localidad_id ?? null;
    // localidad_filter: null = sin filtro (global), número = filtrar por esa localidad
    // Para pesada: filtro via JOIN con configuracion_dispositivos
    // Para operacion_pesaje: filtro directo por localidad_id
    const localidadFiltroDisp = localidadId
      ? `AND EXISTS (SELECT 1 FROM configuracion_dispositivos cd WHERE cd.id = p.dispositivo_id AND cd.localidad_id = ${parseInt(localidadId)})`
      : '';
    const localidadFiltroOp = localidadId
      ? `AND localidad_id = ${parseInt(localidadId)}`
      : '';
    const localidadFiltroRep = localidadId
      ? `AND localidad_id = ${parseInt(localidadId)}`
      : '';

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
             SUM(CASE WHEN abierta = true THEN 1 ELSE 0 END) as abiertas,
             SUM(CASE WHEN abierta = false THEN 1 ELSE 0 END) as cerradas
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

    // 10. Reportes generados hoy
    const ticketsHoy = await pool.query(`
      SELECT COUNT(*) as total_tickets
      FROM reporte
      WHERE DATE(created_at) = CURRENT_DATE
      ${localidadFiltroRep}
    `);

    // 11. Comparativo últimos 6 meses
    const comparativoResult = await pool.query(`
      SELECT
        EXTRACT(YEAR FROM fecha_hora) as anio,
        EXTRACT(MONTH FROM fecha_hora) as mes,
        COUNT(DISTINCT operacion_id) as total_operaciones,
        COALESCE(SUM(neto), 0) as peso_neto
      FROM pesada p
      WHERE fecha_hora >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      ${localidadFiltroDisp}
      GROUP BY EXTRACT(YEAR FROM fecha_hora), EXTRACT(MONTH FROM fecha_hora)
      ORDER BY anio DESC, mes DESC
      LIMIT 6
    `);

    const mesesLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const comparativoMensual = comparativoResult.rows.map(row => ({
      anio: parseInt(row.anio),
      mes: parseInt(row.mes),
      mesNombre: mesesLabels[parseInt(row.mes) - 1],
      totalOperaciones: parseInt(row.total_operaciones),
      pesoNeto: parseFloat(row.peso_neto)
    })).reverse();

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
      debug_version: 'PHASE_3_V2',
      data: {
        hoy: {
          pesadas: parseInt(pesadasHoy.rows[0]?.total || 0),
          bruto: parseFloat(pesadasHoy.rows[0]?.bruto_total || 0),
          tara: parseFloat(pesadasHoy.rows[0]?.tara_total || 0),
          operaciones: parseInt(operacionesHoy.rows[0]?.total || 0),
          operacionesAbiertas: parseInt(operacionesHoy.rows[0]?.abiertas || 0),
          operacionesCerradas: parseInt(operacionesHoy.rows[0]?.cerradas || 0),
          tickets: parseInt(ticketsHoy.rows[0]?.total_tickets || 0),
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
        comparativoMensual,
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
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMetricasPorFecha = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const localidadId = req.user?.localidad_id ?? null;

    const conditions = [];
    const params = [];

    if (fechaInicio && fechaFin) {
      params.push(fechaInicio); conditions.push(`p.fecha_hora >= $${params.length}`);
      params.push(fechaFin);    conditions.push(`p.fecha_hora <= $${params.length}`);
    } else if (fechaInicio) {
      params.push(fechaInicio); conditions.push(`p.fecha_hora >= $${params.length}`);
    } else if (fechaFin) {
      params.push(fechaFin);    conditions.push(`p.fecha_hora <= $${params.length}`);
    }

    if (localidadId) {
      conditions.push(`EXISTS (SELECT 1 FROM configuracion_dispositivos cd WHERE cd.id = p.dispositivo_id AND cd.localidad_id = ${parseInt(localidadId)})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        DATE(p.fecha_hora) as fecha,
        COUNT(*) as total_pesadas,
        COUNT(DISTINCT p.operacion_id) as operaciones,
        COALESCE(SUM(CASE WHEN p.tipo::text = 'BRUTO' THEN p.peso END), 0) as bruto,
        COALESCE(SUM(CASE WHEN p.tipo::text = 'TARA' THEN p.peso END), 0) as tara
      FROM pesada p
      ${whereClause}
      GROUP BY DATE(p.fecha_hora)
      ORDER BY fecha ASC
    `, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        fecha: row.fecha,
        totalPesadas: parseInt(row.total_pesadas),
        operaciones: parseInt(row.operaciones),
        bruto: parseFloat(row.bruto),
        tara: parseFloat(row.tara),
        neto: parseFloat(row.bruto) - parseFloat(row.tara)
      }))
    });
  } catch (error) {
    console.error('Error en getMetricasPorFecha:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getComparativoMensual = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const localidadFiltro = localidadId
      ? `AND EXISTS (SELECT 1 FROM configuracion_dispositivos cd WHERE cd.id = p.dispositivo_id AND cd.localidad_id = ${parseInt(localidadId)})`
      : '';
    const result = await pool.query(`
      SELECT
        EXTRACT(YEAR FROM fecha_hora) as anio,
        EXTRACT(MONTH FROM fecha_hora) as mes,
        COUNT(*) as total_pesadas,
        COALESCE(SUM(CASE WHEN tipo::text = 'BRUTO' THEN peso END), 0) -
        COALESCE(SUM(CASE WHEN tipo::text = 'TARA' THEN peso END), 0) as peso_neto
      FROM pesada p
      WHERE fecha_hora >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      ${localidadFiltro}
      GROUP BY EXTRACT(YEAR FROM fecha_hora), EXTRACT(MONTH FROM fecha_hora)
      ORDER BY anio DESC, mes DESC
      LIMIT 6
    `);

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    res.json({
      success: true,
      data: result.rows.map(row => ({
        anio: parseInt(row.anio),
        mes: parseInt(row.mes),
        mesNombre: meses[parseInt(row.mes) - 1],
        totalPesadas: parseInt(row.total_pesadas),
        pesoNeto: parseFloat(row.peso_neto)
      })).reverse()
    });
  } catch (error) {
    console.error('Error en getComparativoMensual:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};