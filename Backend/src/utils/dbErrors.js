/**
 * Traduce errores de PostgreSQL a mensajes legibles para el usuario.
 * Los constraints conocidos tienen su mensaje; el resto cae en un mensaje por código SQLSTATE.
 */

// Constraint → mensaje. {valor} se reemplaza por el valor duplicado (sin la localidad).
const UNICOS = {
  uq_chofer_codigo_loc:      'Ya existe un chofer con el código "{valor}" en esta localidad',
  uq_chofer_documento_loc:   'Ya existe un chofer con el documento "{valor}" en esta localidad',
  uq_chofer_nombre_loc:      'Ya existe un chofer llamado "{valor}" en esta localidad',
  uq_chofer_cuit:            'Ya existe un chofer con el CUIT "{valor}"',
  uq_vehiculo_patente_loc:   'Ya existe un vehículo con la patente "{valor}" en esta localidad',
  uq_producto_codigo_loc:    'Ya existe un producto con el código "{valor}" en esta localidad',
  uq_producto_nombre_loc:    'Ya existe un producto llamado "{valor}" en esta localidad',
  uq_productor_codigo_loc:   'Ya existe un productor con el código "{valor}" en esta localidad',
  uq_productor_nombre_loc:   'Ya existe un productor llamado "{valor}" en esta localidad',
  uq_transporte_codigo_loc:  'Ya existe un transporte con el código "{valor}" en esta localidad',
  uq_transporte_nombre_loc:  'Ya existe un transporte llamado "{valor}" en esta localidad',
  uq_localidad_provincia:    'Ya existe una localidad llamada "{valor}" en esa provincia',
  empresa_nombre_key:        'Ya existe una empresa llamada "{valor}" (puede estar desactivada)',
  provincia_nombre_key:      'Ya existe una provincia llamada "{valor}"',
  usuario_username_key:      'Ya existe un usuario "{valor}" (puede estar desactivado)',
  configuracion_dispositivo_tipo_localidad_key: 'Esa localidad ya tiene un dispositivo de ese tipo',
  unica_operacion_abierta_por_camion: 'El vehículo "{valor}" ya tiene una operación de pesaje abierta',
  unica_pesada_por_tipo:     'Esa operación ya tiene una pesada de ese tipo',
};

// Tabla que referencia → dónde está en uso lo que se quiso borrar
const USOS = {
  pesada: 'pesadas', operacion_pesaje: 'operaciones de pesaje', localidad: 'localidades', usuario: 'usuarios',
  chofer: 'choferes', vehiculo: 'vehículos', producto: 'productos', productor: 'productores',
  transporte: 'transportes', configuracion_dispositivos: 'dispositivos', reporte: 'reportes', ticket: 'tickets',
};

const COLUMNAS = {
  codigo: 'código', nombre: 'nombre', apellido_nombre: 'nombre', patente: 'patente',
  nro_documento: 'documento', cuit: 'CUIT', localidad_id: 'localidad', tipo_vehiculo: 'tipo de vehículo',
  chofer_id: 'chofer', productor_id: 'productor', transporte_id: 'transporte', producto_id: 'producto',
  operacion_id: 'operación', vehiculo_patente: 'patente',
};

const columna = (c) => COLUMNAS[c] || c;

// Columna FK → mensaje cuando el valor referenciado no existe
const INEXISTENTES = {
  localidad_id: 'La localidad indicada no existe', provincia_id: 'La provincia indicada no existe',
  empresa_id: 'La empresa indicada no existe', chofer_id: 'El chofer indicado no existe',
  producto_id: 'El producto indicado no existe', productor_id: 'El productor indicado no existe',
  transporte_id: 'El transporte indicado no existe', vehiculo_patente: 'El vehículo indicado no existe',
  dispositivo_id: 'El dispositivo indicado no existe', operacion_id: 'La operación indicada no existe',
};

// "Key (codigo, localidad_id)=(CHO01, 1) already exists." → "CHO01" (el detalle sale igual en cualquier idioma)
const valorDuplicado = (detail = '') => {
  const m = detail.match(/\(([^)]*)\)=\((.*)\)/);
  if (!m) return '';
  const cols = m[1].split(',').map((s) => s.trim());
  let valor = m[2];
  if (cols.length > 1 && cols[cols.length - 1] === 'localidad_id') valor = valor.replace(/, \d+$/, '');
  return valor;
};

/** @returns {{status:number, message:string}|null} null si no es un error de PostgreSQL */
export const traducirErrorDb = (error) => {
  const code = error?.code;
  if (typeof code !== 'string' || !/^[0-9A-Z]{5}$/.test(code)) return null;

  switch (code) {
    case '23505': { // unique_violation
      const valor = valorDuplicado(error.detail);
      const plantilla = UNICOS[error.constraint];
      if (plantilla) return { status: 409, message: plantilla.replace('{valor}', valor) };
      return { status: 409, message: valor ? `Ya existe un registro con el valor "${valor}"` : 'Ya existe un registro con esos datos' };
    }
    case '23503': { // foreign_key_violation
      // Borrar algo referenciado: error.table es la tabla que lo usa, no la que se borra
      if (/still referenced|todav[ií]a/i.test(error.detail || '')) {
        const usadoEn = USOS[error.table];
        return { status: 409, message: `No se puede eliminar: está en uso${usadoEn ? ` en ${usadoEn}` : ''}` };
      }
      const col = (error.detail || '').match(/\((\w+)[^)]*\)=/)?.[1]; // primera columna (las FK pueden ser compuestas)
      return { status: 400, message: INEXISTENTES[col] || 'Uno de los datos seleccionados no existe' };
    }
    case '23502': // not_null_violation
      return { status: 400, message: `Falta completar el campo ${columna(error.column)}` };
    case '22001': // string_data_right_truncation
      return { status: 400, message: 'Uno de los datos es demasiado largo' };
    case '22P02': // invalid_text_representation (número o enum inválido)
      return { status: 400, message: 'Uno de los datos tiene un formato inválido' };
    case '23514': // check_violation
      return { status: 400, message: 'Uno de los datos no es válido' };
    case '22003': // numeric_value_out_of_range
      return { status: 400, message: 'Uno de los valores numéricos está fuera de rango' };
    default:
      return { status: 500, message: 'Error en la base de datos' };
  }
};
