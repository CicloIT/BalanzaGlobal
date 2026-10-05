export const choferesConfig = {
  id: 'choferes',
  label: '🚗 Choferes',
  singular: 'chofer',
  plural: 'choferes',
  endpoint: '/api/choferes',
  columnasKeys: ['codigo', 'apellido_nombre', 'nro_documento', 'tipo_documento', 'cuit', 'nacionalidad', 'activo'],
  columnasLabels: ['Código', 'Nombre', 'Documento', 'Tipo Doc.', 'CUIT', 'Nacionalidad', 'Activo'],
  campos: [
    { name: 'codigo', label: 'Código', type: 'text', placeholder: 'CHO001' },
    { name: 'apellido_nombre', label: 'Nombre Completo', type: 'text', placeholder: 'García Juan' },
    {
      name: 'tipo_documento',
      label: 'Tipo Documento',
      type: 'select',
      options: [
        { value: 'DNI', label: 'DNI' },
        { value: 'PASAPORTE', label: 'Pasaporte' },
        { value: 'OTRO', label: 'Otro' }
      ]
    },
    { name: 'nro_documento', label: 'Número Documento', type: 'text', placeholder: '12345678' },
    { name: 'cuit', label: 'CUIT/CUIL', type: 'text', placeholder: '20-12345678-9' },
    { name: 'nacionalidad', label: 'Nacionalidad', type: 'text', placeholder: 'Argentina' },
  ],
};