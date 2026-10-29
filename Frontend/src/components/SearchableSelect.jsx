import React, { useState, useRef, useEffect, useMemo, memo, useId } from 'react';
import { ChevronDown, Search, X, Plus, Check } from 'lucide-react';
import { controlClass } from './ui/controlClass';
import { cx } from '../lib/cx';

// Selector con búsqueda. Si el texto buscado no existe se puede usar como valor nuevo
// (PesadaForm crea la entidad al registrar). Teclado: ↑/↓ para moverse, Enter para elegir, Esc para cerrar.
const SearchableSelect = memo(({
  label,
  name,
  value,
  options, // Array de objetos { id, nombre, patente, etc. }
  onChange,
  placeholder = "Seleccionar...",
  displayKey = "nombre", // La propiedad que se muestra ("nombre", "patente", etc.)
  className = "",
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [activo, setActivo] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  const abrir = () => {
    setSearchTerm('');
    setVisibleCount(50);
    setActivo(0);
    setIsOpen(true);
  };

  const cerrar = (devolverFoco = false) => {
    setIsOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  };

  // Filtrar opciones basadas en el término de búsqueda
  const filteredOptions = useMemo(() => {
    let result = options || [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(opt => {
        const displayVal = String(opt[displayKey] || '').toLowerCase();
        return displayVal.includes(term);
      });
    }
    return result;
  }, [options, searchTerm, displayKey]);

  // Aplicar límite visible de la "paginación" local
  const displayedOptions = useMemo(() => {
    return filteredOptions.slice(0, visibleCount);
  }, [filteredOptions, visibleCount]);

  const coincideExacto = searchTerm && filteredOptions.some(
    opt => String(opt[displayKey] || '').toLowerCase() === searchTerm.toLowerCase()
  );
  const ofrecerNuevo = Boolean(searchTerm) && !coincideExacto;

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Cargar más cuando estemos cerca del final (a 50px)
    if (scrollHeight - scrollTop - clientHeight < 50) {
      if (visibleCount < filteredOptions.length) {
        setVisibleCount(prev => prev + 50);
      }
    }
  };

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Mantener visible la opción activa al moverse con el teclado
  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.querySelector(`[data-index="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } });
    cerrar(true);
  };

  const limpiar = (e) => {
    e.stopPropagation();
    onChange({ target: { name, value: '' } });
  };

  const totalNavegable = displayedOptions.length + (ofrecerNuevo ? 1 : 0);

  const onKeyDownBusqueda = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo(i => Math.min(i + 1, Math.max(totalNavegable - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activo < displayedOptions.length) handleSelect(displayedOptions[activo][displayKey]);
      else if (ofrecerNuevo) handleSelect(searchTerm);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar(true);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const listId = `${id}-lista`;

  return (
    <div className={cx('relative', className)} ref={containerRef}>
      {label && (
        <label htmlFor={`${id}-trigger`} className="mb-1.5 flex items-center gap-1 text-sm font-medium text-fg">
          {label}
          {required && <span className="text-danger" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          id={`${id}-trigger`}
          type="button"
          onClick={() => (isOpen ? cerrar() : abrir())}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' && !isOpen) { e.preventDefault(); abrir(); } }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          className={cx(controlClass, 'flex items-center justify-between gap-2 text-left pr-16', isOpen && 'border-brand-solid ring-3 ring-brand-solid/20')}
        >
          <span className={cx('truncate', !value && 'text-fg-subtle')}>{value || placeholder}</span>
        </button>
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={limpiar}
              aria-label={`Quitar ${label ?? 'selección'}`}
              className="pointer-events-auto p-1 rounded text-fg-subtle hover:text-fg hover:bg-surface-3"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} aria-hidden="true" className={cx('text-fg-subtle transition-transform', isOpen && 'rotate-180')} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-40 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-lg border border-line bg-surface shadow-pop animate-pop-in">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search size={15} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                autoFocus
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={totalNavegable ? `${id}-op-${activo}` : undefined}
                aria-label={`Buscar ${label ?? ''}`}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(50); setActivo(0); }}
                onKeyDown={onKeyDownBusqueda}
                placeholder="Buscar..."
                className="h-9 w-full rounded-md border border-line bg-surface-2 pl-8 pr-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-brand-solid"
              />
            </div>
          </div>

          <ul id={listId} ref={listRef} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto py-1" onScroll={handleScroll}>
            {displayedOptions.map((opt, idx) => {
              const texto = opt[displayKey];
              const seleccionado = value === texto;
              return (
                <li
                  key={opt.id || idx}
                  id={`${id}-op-${idx}`}
                  data-index={idx}
                  role="option"
                  aria-selected={seleccionado}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(texto)}
                  onMouseEnter={() => setActivo(idx)}
                  className={cx(
                    'flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer',
                    idx === activo ? 'bg-surface-3 text-fg' : 'text-fg-muted',
                    seleccionado && 'font-semibold text-brand'
                  )}
                >
                  <span className="truncate">{texto}</span>
                  {seleccionado && <Check size={14} aria-hidden="true" />}
                </li>
              );
            })}

            {ofrecerNuevo && (
              <li
                id={`${id}-op-${displayedOptions.length}`}
                data-index={displayedOptions.length}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(searchTerm)}
                onMouseEnter={() => setActivo(displayedOptions.length)}
                className={cx(
                  'flex items-center gap-2 border-t border-line px-3 py-2 text-sm cursor-pointer text-brand',
                  activo === displayedOptions.length && 'bg-brand-soft'
                )}
              >
                <Plus size={14} aria-hidden="true" />
                Usar “{searchTerm}” como nuevo
              </li>
            )}

            {!displayedOptions.length && !ofrecerNuevo && (
              <li className="px-3 py-6 text-center text-sm text-fg-subtle">No hay opciones cargadas</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
});

export default SearchableSelect;
