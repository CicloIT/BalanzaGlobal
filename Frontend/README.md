# Frontend — Sistema de Balanzas

React + Vite + Tailwind.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
```

El dev server hace proxy de `/api`, `/capturas`, `/documentos` y `/ws` al backend en `http://localhost:3000` (ver `vite.config.js`).

## Producción

```bash
npm run build
```

El backend sirve `Frontend/dist` directamente; no hace falta otro servidor.

## Estructura

- `src/lib/api.js` — base de la API (`VITE_API_URL`, vacío = mismo origen) y headers de usuario (`getAuthHeaders`).
- `src/config/*Config.js` — definición de cada catálogo (columnas, campos, endpoint).
- `src/config/rolesConfig.js` — permisos por rol; mantener sincronizado con `Backend/src/config/rolesConfig.js`.
- `src/hooks/` — acceso a datos (`useGestionAPI`, listas paginadas) y permisos.
