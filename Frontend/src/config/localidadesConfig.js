export const localidadesConfig = {
    id: 'localidades',
    label: '🌆 Localidades',
    singular: 'localidad',
    plural: 'localidades',
    endpoint: '/api/localidades',
    columnasKeys: ['id', 'nombre', 'provincia_nombre'],
    columnasLabels: ['ID', 'Nombre', 'Provincia'],
    campos: [
        { name: 'nombre', label: 'Nombre de la Localidad', type: 'text', placeholder: 'Bahía Blanca' },
        { name: 'provincia_id', label: 'ID de la Provincia (ver pestaña Provincias)', type: 'number', placeholder: 'Ej: 1' },
    ],
};
