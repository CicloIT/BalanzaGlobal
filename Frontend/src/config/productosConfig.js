export const productosConfig = {
  id: 'productos',
  label: '📦 Productos',
  singular: 'producto',
  plural: 'productos',
  endpoint: '/api/productos',
  columnasKeys: ['codigo', 'nombre', 'activo'],
  columnasLabels: ['Código', 'Nombre', 'Activo'],
  campos: [
    { name: 'codigo', label: 'Código', type: 'text', placeholder: 'PROD-001' },
    { name: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Soja' },
  ],
};