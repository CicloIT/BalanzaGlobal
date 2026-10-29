# 09 — Interfaz y sistema de diseño

Cómo está armado el frontend (`Frontend/src`) para que las pantallas nuevas mantengan el mismo estilo.

## Tema y colores

- Los colores son **tokens semánticos** definidos como variables CSS en `src/index.css`
  (`:root` para claro, `.dark` para oscuro) y expuestos a Tailwind con `@theme inline`.
- Se usan como utilidades normales: `bg-surface`, `bg-surface-2`, `border-line`, `text-fg`,
  `text-fg-muted`, `text-fg-subtle`, `bg-brand-solid`, `text-brand`, `bg-success-soft text-success`,
  `text-warning`, `text-danger`, `bg-ingreso-soft text-ingreso`, `bg-salida-soft text-salida`.
- **No usar** `isDark ? 'clase-oscura' : 'clase-clara'`: el tema lo resuelven las variables. `isDark`
  solo se usa para el botón de tema y los colores de los gráficos (recharts no lee clases).
- El tema se guarda en `localStorage.theme`; `index.html` lo aplica antes de pintar (sin parpadeo).
- Fuentes: Inter (texto) y JetBrains Mono (pesos, patentes, IPs). Números con `tabular`.

## Componentes base (`src/components/ui/`)

| Componente | Uso |
|---|---|
| `Button` | Variantes `primary`, `secondary`, `ghost`, `danger`, `danger-soft`, `soft`, `success`, `salida`; tamaños `sm`/`md`/`lg`/`xl`/`icon`; `loading`; `as="a"` o `as="label"` (subir archivo) |
| `Card`, `CardHeader`, `CardBody` | Paneles. `CardHeader` lleva icono, título, descripción y acciones |
| `PageHeader` | Título de cada pantalla + descripción + acciones principales |
| `Field`, `Input`, `Select` | Formularios: etiqueta asociada, `required`/`optional`, `hint` y `error` accesibles |
| `Badge` | Estados (siempre con texto, nunca solo color) |
| `Alert` | Avisos dentro de la página (`info`, `success`, `warning`, `danger`) |
| `Modal` | Diálogos: Escape/clic afuera cierran, foco adentro, en celular sube desde abajo |
| `Segmented` | Filtros rápidos excluyentes (sentido, fecha) |
| `EmptyState`, `LoadingState`, `Spinner` | Estados vacíos y de carga |
| `FeedbackProvider` | Avisos flotantes y confirmaciones: `useToast()` y `useConfirm()` de `context/feedback.js` |

No usar `alert()` ni `window.confirm()`: usar `toast.error(...)` y `await confirm({ title, message, tone: 'danger' })`.

## Layout

- `components/layout/AppShell.jsx`: menú lateral (`Sidebar`) + barra superior (`Topbar`) + contenido.
- El menú se define en `config/navigation.js` (grupos Operación / Catálogos / Administración, icono y
  descripción de cada sección). `GestionApp` decide qué ítems ve cada usuario según sus permisos.
- Escritorio: menú fijo y contraíble (se recuerda en `localStorage.sidebar_colapsado`). Celular y
  tablet: menú en cajón con el botón ☰.
- Barra superior: ubicación (grupo › pantalla), alcance (localidad / todas / plataforma), tema y
  menú de usuario con cierre de sesión.

## Pantallas

- **Nueva pesada**: datos a la izquierda (vehículo y operación, datos de la carga, carta de porte,
  cámaras) y a la derecha, fijo, el panel de balanza (lectura en vivo con estado *desconectada /
  inestable / estable*), el peso a registrar y el resumen antes de confirmar.
- **Listados** (`GestionApp` + `TablaItems`): encabezado con total real, búsqueda o filtros, tabla en
  escritorio (columna Acciones fija a la derecha) y tarjetas en celular.
- **Dashboard**: solo datos del backend (`/api/metricas/dashboard`); se carga bajo demanda porque
  incluye la librería de gráficos.
- **Configuración**: pestañas Dispositivos / Respaldos según permisos.

## Reglas para pantallas nuevas

1. Empezar con `PageHeader` y agrupar en `Card`.
2. Formularios con `Field` (+ `required` en lo que exige el backend).
3. Estados de carga, vacío y error siempre visibles (`LoadingState`, `EmptyState`, `Alert`).
4. Acciones según permisos con `Guard` (la seguridad real la hace el backend).
5. Contenedores con scroll horizontal: `relative overflow-x-auto` (si no, los `sr-only` internos
   ensanchan la página).
