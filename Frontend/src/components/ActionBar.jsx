import React from 'react';
import { Plus } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import Guard from './Guard';

export default function ActionBar({
  titulo,
  count,
  onAgregar,
  loading = false,
  soloLectura = false,
  permission = null
}) {
  const { isDark } = useThemeContext();

  return (
    <div className={`px-6 py-5 border-b flex justify-between items-center transition-colors duration-300 ${
      isDark
        ? 'border-white/10 bg-linear-to-r from-white/5 to-white/0'
        : 'border-slate-200 bg-linear-to-r from-slate-50 to-white'
    }`}>
      <div>
        <p className={`text-sm transition-colors duration-300 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total de registros</p>
        <p className={`text-2xl font-bold mt-1 transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <span className={`bg-clip-text text-transparent ${
            isDark
              ? 'bg-linear-to-r from-blue-400 to-cyan-400'
              : 'bg-linear-to-r from-blue-600 to-cyan-600'
          }`}>{count}</span>
          <span className={`text-lg ml-2 transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{titulo}</span>
        </p>
      </div>

      <Guard permissions={permission}>
        {!soloLectura && (
          <button
            onClick={onAgregar}
            disabled={loading}
            className={`flex items-center gap-2 px-6 py-3 bg-linear-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/50 transition-all font-semibold hover:scale-105 active:scale-95 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Plus size={22} /> {loading ? 'Cargando...' : 'Agregar'}
          </button>
        )}
      </Guard>
    </div>
  );
}