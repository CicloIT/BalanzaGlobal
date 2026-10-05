export const transportesConfig = {
  id: 'transportes',
  label: '🚛 Transportes',
  singular: 'transporte',
  plural: 'transportes',
  endpoint: '/api/transportes',
  columnasKeys: ['codigo', 'nombre', 'cuit', 'activo'],
  columnasLabels: ['Código', 'Nombre', 'CUIT', 'Activo'],
  campos: [
    { name: 'codigo', label: 'Código', type: 'text', placeholder: 'TRANS001' },
    { name: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Transportes ABC' },
    { name: 'cuit', label: 'CUIT', type: 'text', placeholder: '30987654321' },
  ],
};