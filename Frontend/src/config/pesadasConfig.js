export const pesadasConfig = {
  id: 'pesadas',
  label: '⚖️ Pesadas',
  singular: 'pesada',
  plural: 'pesadas',
  endpoint: '/api/pesadas/agrupadas',
  columnasKeys: [
    'operacion_id',
    'vehiculo_patente',
    'sentido',
    'bruto',
    'tara',
    'neto',
    'fecha_entrada',
    'fecha_salida',
    'abierta'
  ],
  columnasLabels: [
    'N° Op.',
    'Patente',
    'Sentido',
    'Peso Bruto (kg)',
    'Peso Tara (kg)',
    'Peso Neto (kg)',
    'Entrada Planta',
    'Salida Planta',
    'Estado'
  ],
  campos: [
    { name: 'vehiculo_patente', label: 'Patente del Vehículo', type: 'text', placeholder: 'ABC123' },
    { name: 'bruto', label: 'Peso Bruto (kg)', type: 'number', placeholder: '0' },
    { name: 'tara', label: 'Peso Tara (kg)', type: 'number', placeholder: '0' },
  ],
};
