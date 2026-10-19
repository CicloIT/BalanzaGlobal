export const empresasConfig = {
    id: 'empresas',
    label: '🏢 Empresas',
    singular: 'empresa',
    plural: 'empresas',
    endpoint: '/api/empresas',
    columnasKeys: ['id', 'nombre', 'cuit', 'cantidad_localidades', 'activo'],
    columnasLabels: ['ID', 'Nombre', 'CUIT', 'Localidades', 'Activa'],
    campos: [
        { name: 'nombre', label: 'Nombre de la Empresa', type: 'text', placeholder: 'Agro SA' },
        { name: 'cuit', label: 'CUIT', type: 'text', placeholder: '30-12345678-9' },
    ],
};
