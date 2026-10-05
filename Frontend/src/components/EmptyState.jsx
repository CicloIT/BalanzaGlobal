import React from 'react';
import { useThemeContext } from '../context/ThemeContext';

export default function EmptyState({ 
  mensaje = 'No hay datos registrados',
  icono = '📭'
}) {
  const { isDark } = useThemeContext();

  return (
    <div className="p-16 text-center">
      <div className="text-6xl mb-4 animate-bounce" style={{animationDuration: '2s'}}>
        {icono}
      </div>
      <p className={`text-lg transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{mensaje}</p>
      <p className={`text-sm mt-2 transition-colors duration-300 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Comienza agregando un nuevo registro</p>
    </div>
  );
}