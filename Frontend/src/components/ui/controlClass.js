// Estilo común de inputs/selects (también lo usan controles propios como SearchableSelect)
export const controlClass = [
  'w-full h-10 px-3 rounded-lg border border-line-strong bg-surface text-fg text-sm',
  'placeholder:text-fg-subtle transition-colors',
  'hover:border-fg-subtle focus:outline-none focus:border-brand-solid focus:ring-3 focus:ring-brand-solid/20',
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-surface-2',
  'aria-[invalid=true]:border-danger',
].join(' ');
