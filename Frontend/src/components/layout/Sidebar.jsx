import React from 'react';
import { Scale, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { NAV_GROUPS } from '../../config/navigation';
import { cx } from '../../lib/cx';

function Marca({ colapsado }) {
  return (
    <div className={cx('flex items-center gap-2.5 h-14 shrink-0', colapsado ? 'justify-center px-0' : 'px-4')}>
      <div className="grid place-items-center h-8 w-8 rounded-lg bg-brand-solid text-white shrink-0">
        <Scale size={17} aria-hidden="true" />
      </div>
      {!colapsado && (
        <div className="leading-tight min-w-0">
          <p className="text-sm font-semibold text-fg">Balanza</p>
          <p className="text-[11px] text-fg-subtle">Gestión de pesadas</p>
        </div>
      )}
    </div>
  );
}

// Lista de grupos e ítems. `visibles` = ids permitidos para el usuario.
function Navegacion({ visibles, activo, onSelect, colapsado }) {
  return (
    <nav aria-label="Secciones" className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
      {NAV_GROUPS.map(grupo => {
        const items = grupo.items.filter(i => visibles.has(i.id));
        if (!items.length) return null;
        return (
          <div key={grupo.key}>
            {colapsado
              ? <div className="mx-3 mb-2 h-px bg-line" aria-hidden="true" />
              : <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{grupo.label}</p>}
            <ul className="space-y-0.5">
              {items.map(({ id, label, icon: Icon }) => {
                const esActivo = id === activo;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      aria-current={esActivo ? 'page' : undefined}
                      title={colapsado ? label : undefined}
                      className={cx(
                        'group relative w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                        colapsado ? 'justify-center h-10' : 'h-9 px-3',
                        esActivo
                          ? 'bg-brand-soft text-brand'
                          : 'text-fg-muted hover:bg-surface-3 hover:text-fg'
                      )}
                    >
                      {esActivo && <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-solid" />}
                      <Icon size={18} aria-hidden="true" className="shrink-0" />
                      {colapsado ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ visibles, activo, onSelect, colapsado, onToggleColapsado, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Escritorio: fijo, contraíble */}
      <aside
        className={cx(
          'hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-line bg-surface transition-[width] duration-200',
          colapsado ? 'w-16' : 'w-60'
        )}
      >
        <Marca colapsado={colapsado} />
        <Navegacion visibles={visibles} activo={activo} onSelect={onSelect} colapsado={colapsado} />
        <div className="border-t border-line p-2">
          <button
            type="button"
            onClick={onToggleColapsado}
            className={cx(
              'w-full flex items-center gap-3 h-9 rounded-lg text-sm text-fg-subtle hover:bg-surface-3 hover:text-fg',
              colapsado ? 'justify-center' : 'px-3'
            )}
            aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
            title={colapsado ? 'Expandir menú' : undefined}
          >
            {colapsado ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> Contraer menú</>}
          </button>
        </div>
      </aside>

      {/* Móvil / tablet: cajón */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-surface border-r border-line shadow-pop animate-slide-in-left">
            <div className="flex items-center justify-between pr-2">
              <Marca colapsado={false} />
              <button type="button" onClick={onCloseMobile} aria-label="Cerrar menú" className="p-2 rounded-lg text-fg-subtle hover:bg-surface-3">
                <X size={20} />
              </button>
            </div>
            <Navegacion
              visibles={visibles}
              activo={activo}
              onSelect={(id) => { onSelect(id); onCloseMobile(); }}
              colapsado={false}
            />
          </aside>
        </div>
      )}
    </>
  );
}
