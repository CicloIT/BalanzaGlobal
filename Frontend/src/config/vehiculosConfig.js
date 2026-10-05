export const vehiculosConfig = {
  id: 'vehiculos',
  label: '🚗 Vehículos',
  singular: 'vehículo',
  plural: 'vehículos',
  endpoint: '/api/vehiculos',
  columnasKeys: ['patente', 'patente_acoplado', 'tipo_vehiculo', 'activo'],
  columnasLabels: ['Patente', 'Acoplado', 'Tipo', 'Activo'],
  campos: [
    { name: 'patente', label: 'Patente', type: 'text', placeholder: 'ABC-123' },
    { name: 'patente_acoplado', label: 'Patente Acoplado', type: 'text', placeholder: 'XYZ-789' },
    { name: 'tipo_vehiculo', label: 'Tipo de Vehículo', type: 'select',options:['CHASIS','SEMI_REMOLQUE','FURGON','CAMION_TANQUE','CHASIS_ACOPLADO','JAULA_DOBLE','BATEA','OTRO']},
    { name: 'observaciones', label: 'Observaciones', type: 'text', placeholder: 'Notas opcionales' },
  ],
};
