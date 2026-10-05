export const provinciasConfig = {
    id: 'provincias',
    label: '📍 Provincias',
    singular: 'provincia',
    plural: 'provincias',
    endpoint: '/api/provincias',
    columnasKeys: ['id', 'nombre'],
    columnasLabels: ['ID', 'Nombre'],
    campos: [
        { name: 'nombre', label: 'Nombre de la Provincia', type: 'text', placeholder: 'Buenos Aires' },
    ],
};
