import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { cx } from '../../lib/cx';

const CLAVE_COLAPSADO = 'sidebar_colapsado';

const leerColapsado = () => {
  try { return localStorage.getItem(CLAVE_COLAPSADO) === '1'; } catch { return false; }
};

// Estructura general: menú lateral + barra superior + contenido
export default function AppShell({ visibles, activo, onSelect, children }) {
  const [colapsado, setColapsado] = useState(leerColapsado);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleColapsado = () => setColapsado(v => {
    try { localStorage.setItem(CLAVE_COLAPSADO, v ? '0' : '1'); } catch { /* sin storage */ }
    return !v;
  });

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        visibles={visibles}
        activo={activo}
        onSelect={onSelect}
        colapsado={colapsado}
        onToggleColapsado={toggleColapsado}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={cx('flex min-h-screen flex-col transition-[padding] duration-200', colapsado ? 'lg:pl-16' : 'lg:pl-60')}>
        <Topbar activo={activo} onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <footer className="px-6 py-4 text-center text-xs text-fg-subtle">
          © 2026 CicloIT · Balanza v1.0.1
        </footer>
      </div>
    </div>
  );
}
