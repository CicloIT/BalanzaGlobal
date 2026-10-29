import React, { useEffect, useRef, useState } from 'react';
import { Menu, Sun, Moon, LogOut, ChevronDown, ChevronRight, MapPin, Building2 } from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { NAV_ITEMS, ROLE_LABELS } from '../../config/navigation';

function iniciales(nombre = '') {
  return nombre.replace(/[^a-zA-Z0-9 _.-]/g, '').split(/[\s_.-]+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]?.toUpperCase()).join('') || '?';
}

export default function Topbar({ activo, onOpenMenu }) {
  const { isDark, toggleTheme } = useThemeContext();
  const { user, logout, localidad_nombre, empresa_nombre, isGlobal, isSuperadmin } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);
  const item = NAV_ITEMS[activo];

  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e) => { if (!menuRef.current?.contains(e.target)) setMenuAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenuAbierto(false); };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', esc);
    };
  }, [menuAbierto]);

  const rol = ROLE_LABELS[user?.rol?.toLowerCase()] ?? user?.rol;
  const ambito = isSuperadmin
    ? 'Toda la plataforma'
    : isGlobal ? 'Todas las localidades' : localidad_nombre;

  return (
    <header className="sticky top-0 z-20 h-14 flex items-center gap-3 px-4 sm:px-6 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <button
        type="button"
        onClick={onOpenMenu}
        className="lg:hidden -ml-1 p-2 rounded-lg text-fg-muted hover:bg-surface-3"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <nav aria-label="Ubicación" className="flex items-center gap-1.5 min-w-0 text-sm">
        {item?.group && (
          <>
            <span className="hidden sm:inline text-fg-subtle">{item.group}</span>
            <ChevronRight size={14} className="hidden sm:inline text-fg-subtle shrink-0" aria-hidden="true" />
          </>
        )}
        <span className="font-semibold text-fg truncate">{item?.label ?? 'Inicio'}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {ambito && (
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-muted">
            {isGlobal ? <Building2 size={13} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
            {ambito}
          </span>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-fg-muted hover:bg-surface-3 hover:text-fg"
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuAbierto(v => !v)}
              aria-haspopup="menu"
              aria-expanded={menuAbierto}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-surface-3"
            >
              <span className="grid place-items-center h-8 w-8 rounded-full bg-brand-soft text-brand text-xs font-bold">
                {iniciales(user.username)}
              </span>
              <span className="hidden sm:block text-left leading-tight">
                <span className="block text-sm font-medium text-fg">{user.username}</span>
                <span className="block text-[11px] text-fg-subtle">{rol}</span>
              </span>
              <ChevronDown size={14} className="text-fg-subtle" aria-hidden="true" />
            </button>

            {menuAbierto && (
              <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-surface shadow-pop animate-pop-in overflow-hidden">
                <div className="px-4 py-3 border-b border-line">
                  <p className="text-sm font-semibold text-fg">{user.username}</p>
                  <p className="text-xs text-fg-subtle">{rol}</p>
                  {(empresa_nombre || ambito) && (
                    <dl className="mt-2 space-y-1 text-xs">
                      {empresa_nombre && (
                        <div className="flex gap-2"><dt className="text-fg-subtle w-16">Empresa</dt><dd className="text-fg-muted">{empresa_nombre}</dd></div>
                      )}
                      {ambito && (
                        <div className="flex gap-2"><dt className="text-fg-subtle w-16">Alcance</dt><dd className="text-fg-muted">{ambito}</dd></div>
                      )}
                    </dl>
                  )}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft"
                >
                  <LogOut size={16} aria-hidden="true" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
