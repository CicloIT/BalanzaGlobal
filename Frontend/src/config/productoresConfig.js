export const productoresConfig = {
  id: 'productores',
  label: '🏭 Productores',
  singular: 'productor',
  plural: 'productores',
  endpoint: '/api/productores',
  columnasKeys: ['codigo', 'nombre', 'activo'],
  columnasLabels: ['Código', 'Nombre', 'Activo'],
  campos: [
    { name: 'codigo', label: 'Código', type: 'text', placeholder: 'PROD001' },
    { name: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Productor ABC' },
  ],
};