import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Scale, ClipboardList, BarChart3,
  User, Truck, Package, Building2, MapPin, Map, Users,
  Sun, Moon, LogOut, Shield, UserCog, Wrench, Crown, TrendingUp,
  Menu, X, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

/* ─── Icon map ────────────────────────────────────────────────────────────── */
const TAB_ICONS = {
  dashboard:            <LayoutDashboard  size={15} strokeWidth={2} />,
  pesada:               <Scale            size={15} strokeWidth={2} />,
  pesadas:              <ClipboardList    size={15} strokeWidth={2} />,
  'reportes-historial': <BarChart3        size={15} strokeWidth={2} />,
  choferes:             <User             size={15} strokeWidth={2} />,
  productores:          <Building2        size={15} strokeWidth={2} />,
  productos:            <Package          size={15} strokeWidth={2} />,
  transportes:          <Truck            size={15} strokeWidth={2} />,
  vehiculos:            <Truck            size={15} strokeWidth={2} />,
  provincias:           <Map              size={15} strokeWidth={2} />,
  localidades:          <MapPin           size={15} strokeWidth={2} />,
  usuarios:             <Users            size={15} strokeWidth={2} />,
  configuracion:        <Shield          size={15} strokeWidth={2} />,
};

const ROLE_ICONS = {
  admin:       <Crown       size={13} strokeWidth={2.5} />,
  logistica:   <TrendingUp  size={13} strokeWidth={2.5} />,
  gerente:     <UserCog     size={13} strokeWidth={2.5} />,
  balancero:   <Scale       size={13} strokeWidth={2.5} />,
  subalancero: <Wrench      size={13} strokeWidth={2.5} />,
};

const ROLE_COLORS = {
  admin:       'text-amber-400',
  logistica:   'text-emerald-400',
  gerente:     'text-blue-400',
  balancero:   'text-cyan-400',
  subalancero: 'text-purple-400',
};

/* ─── Section definition ─────────────────────────────────────────────────── */
//  Each section has an icon, label, and the module ids that belong to it.
const SECTIONS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={16} strokeWidth={2} />,
    ids: ['dashboard'],
    direct: true, // clicking the section directly navigates (no sub-row needed)
  },
  {
    key: 'pesajes',
    label: 'Pesajes',
    icon: <Scale size={16} strokeWidth={2} />,
    ids: ['pesada', 'pesadas', 'reportes-historial'],
  },
  {
    key: 'maestros',
    label: 'Maestros',
    icon: <Package size={16} strokeWidth={2} />,
    ids: ['choferes', 'productores', 'productos', 'transportes', 'vehiculos', 'provincias', 'localidades', 'usuarios'],
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    icon: <Shield size={16} strokeWidth={2} />,
    ids: ['configuracion'],
    direct: true,
  },
];

function cleanLabel(label) {
  return label.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function Header({ activeTab, onTabChange, tabs }) {
  const { isDark, toggleTheme } = useThemeContext();
  const { user, logout, localidad_nombre, isGlobal } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef(null);

  // Build a lookup: id → tab object
  const tabMap = Object.fromEntries(tabs.map(t => [t.id, t]));

  // Determine which section the active tab belongs to
  const activeSectionKey = SECTIONS.find(s => s.ids.includes(activeTab))?.key ?? 'dashboard';

  // Sections that are visible (have at least one tab available for this user)
  const visibleSections = SECTIONS.filter(s => s.ids.some(id => tabMap[id]));

  // Sub-tabs for the active section
  const activeSection = visibleSections.find(s => s.key === activeSectionKey);
  const subTabs = (activeSection?.ids ?? []).filter(id => tabMap[id]).map(id => tabMap[id]);
  const showSubRow = subTabs.length > 1;

  // Handle section click
  const handleSectionClick = (section) => {
    if (section.direct || section.ids.length === 1) {
      // Navigate directly
      const firstAvailable = section.ids.find(id => tabMap[id]);
      if (firstAvailable) onTabChange(firstAvailable);
    } else {
      // Jump to first sub-tab of this section
      const firstAvailable = section.ids.find(id => tabMap[id]);
      if (firstAvailable) onTabChange(firstAvailable);
    }
  };

  // Close mobile drawer on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const h = (e) => { if (drawerRef.current && !drawerRef.current.contains(e.target)) setMobileOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [mobileOpen]);

  const rolColor = ROLE_COLORS[user?.rol] ?? 'text-slate-400';
  const rolIcon  = ROLE_ICONS[user?.rol]  ?? <User size={13} />;

  /* ── Section tab button (row 1) ── */
  const SectionBtn = ({ section }) => {
    const isActive = section.key === activeSectionKey;
    return (
      <button
        onClick={() => handleSectionClick(section)}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95 border-b-2 whitespace-nowrap ${
          isActive
            ? isDark
              ? 'border-blue-400 text-blue-400'
              : 'border-blue-500 text-blue-600'
            : isDark
              ? 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
        }`}
      >
        <span className={isActive ? (isDark ? 'text-blue-400' : 'text-blue-500') : ''}>{section.icon}</span>
        {section.label}
        {!section.direct && section.ids.filter(id => tabMap[id]).length > 1 && (
          <ChevronDown size={13} className={`transition-transform ${isActive ? 'rotate-180' : ''}`} />
        )}
      </button>
    );
  };

  /* ── Sub-tab button (row 2) ── */
  const SubTabBtn = ({ tab }) => {
    const isActive = activeTab === tab.id;
    const icon = TAB_ICONS[tab.id];
    const label = cleanLabel(tab.label);
    return (
      <button
        onClick={() => onTabChange(tab.id)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 whitespace-nowrap ${
          isActive
            ? isDark
              ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/30'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-400/25'
            : isDark
              ? 'text-slate-400 hover:text-white hover:bg-white/8'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
      >
        <span className={isActive ? 'text-white' : isDark ? 'text-slate-500' : 'text-slate-400'}>{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <>
      <header className={`sticky top-0 z-40 transition-colors duration-300 backdrop-blur-xl border-b ${
        isDark ? 'bg-slate-950/93 border-white/8' : 'bg-white/93 border-slate-200'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* ── Top bar ── */}
          <div className="flex items-center justify-between py-3 gap-3">

            {/* Brand */}
            <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/30 flex-shrink-0">
                <Scale size={17} strokeWidth={2} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className={`text-lg font-black leading-none tracking-tight ${
                  isDark
                    ? 'bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent'
                    : 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent'
                }`}>Balanza Pro</h1>
                <p className={`text-[9px] font-semibold uppercase tracking-widest mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sistema de Gestión
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {user && (
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`${rolColor} flex-shrink-0`}>{rolIcon}</span>
                  <div className="leading-none">
                    <p className={`text-[8px] font-black uppercase tracking-[0.12em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {user.rol}{isGlobal ? ' · Global' : localidad_nombre ? ` · ${localidad_nombre}` : ''}
                    </p>
                    <p className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{user.username}</p>
                  </div>
                </div>
              )}

              <button onClick={toggleTheme}
                className={`p-2 rounded-xl border transition-all active:scale-95 ${
                  isDark ? 'bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}>
                {isDark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
              </button>

              {user && (
                <button onClick={logout}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border font-bold text-sm transition-all active:scale-95 ${
                    isDark ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                  }`}>
                  <LogOut size={14} strokeWidth={2} />
                  <span className="hidden md:inline">Salir</span>
                </button>
              )}

              {/* Hamburger — mobile only */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className={`lg:hidden p-2 rounded-xl border transition-all active:scale-95 ${
                  mobileOpen
                    ? isDark ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
                aria-label="Menú"
              >
                {mobileOpen ? <X size={17} /> : <Menu size={17} />}
              </button>
            </div>
          </div>

          {/* ── Desktop nav: Row 1 — sections ── */}
          <div className="hidden lg:flex items-center gap-1 border-t border-b-0 border-transparent">
            {/* Left: section buttons */}
            <div className={`flex items-center border-b ${isDark ? 'border-white/8' : 'border-slate-100'} flex-1`}>
              {visibleSections.map(s => <SectionBtn key={s.key} section={s} />)}
            </div>
          </div>

          {/* ── Desktop nav: Row 2 — sub-tabs (only when section has multiple) ── */}
          {showSubRow && (
            <div className="hidden lg:flex items-center gap-1 py-2.5">
              {subTabs.map(tab => <SubTabBtn key={tab.id} tab={tab} />)}
            </div>
          )}

          {/* ── Mobile: current location pill ── */}
          <div className="lg:hidden flex items-center gap-2 pb-3 pt-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
              isDark ? 'bg-white/8 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}>
              {TAB_ICONS[activeTab] ?? <LayoutDashboard size={13} />}
              <span>{cleanLabel(tabs.find(t => t.id === activeTab)?.label ?? '')}</span>
            </div>
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              ☰ Menú para cambiar sección
            </span>
          </div>

        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div ref={drawerRef}
            className={`relative ml-auto w-72 max-w-[85vw] h-full flex flex-col shadow-2xl animate-slideInRight ${
              isDark ? 'bg-slate-900 border-l border-white/10' : 'bg-white border-l border-slate-200'
            }`}
          >
            {/* Drawer header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <div>
                <p className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>Secciones</p>
                {user && (
                  <p className={`text-xs mt-0.5 flex items-center gap-1 ${rolColor}`}>
                    {rolIcon}
                    <span className="font-bold">{user.username}</span>
                    <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                      · {user.rol}{isGlobal ? ' · Global' : localidad_nombre ? ` · ${localidad_nombre}` : ''}
                    </span>
                  </p>
                )}
              </div>
              <button onClick={() => setMobileOpen(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X size={18} />
              </button>
            </div>

            {/* Sections with sub-tabs */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
              {visibleSections.map(section => {
                const sectionTabs = section.ids.filter(id => tabMap[id]).map(id => tabMap[id]);
                const isSectionActive = section.key === activeSectionKey;
                return (
                  <div key={section.key}>
                    {/* Section label */}
                    <p className={`flex items-center gap-2 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] ${
                      isSectionActive
                        ? isDark ? 'text-blue-400' : 'text-blue-500'
                        : isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {section.icon}
                      {section.label}
                    </p>

                    {/* Section sub-tabs */}
                    {sectionTabs.map(tab => {
                      const isActive = activeTab === tab.id;
                      const icon = TAB_ICONS[tab.id];
                      const label = cleanLabel(tab.label);
                      return (
                        <button key={tab.id}
                          onClick={() => { onTabChange(tab.id); setMobileOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                            isActive
                              ? isDark
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-400/20'
                              : isDark
                                ? 'text-slate-300 hover:bg-white/8 hover:text-white'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}>
                          <span className={isActive ? 'text-white' : isDark ? 'text-slate-500' : 'text-slate-400'}>{icon}</span>
                          <span className="flex-1 text-left">{label}</span>
                          {isActive && <ChevronRight size={13} className="text-white/70" />}
                        </button>
                      );
                    })}

                    {/* Section divider */}
                    <div className={`my-2 h-px ${isDark ? 'bg-white/6' : 'bg-slate-100'}`} />
                  </div>
                );
              })}
            </nav>

            {/* Logout */}
            <div className={`px-4 py-4 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <button onClick={logout}
                className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all active:scale-95 ${
                  isDark ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                }`}>
                <LogOut size={14} strokeWidth={2} /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        .animate-slideInRight { animation: slideInRight 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
      `}</style>
    </>
  );
}