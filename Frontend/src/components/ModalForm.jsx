import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import InputField from './InputField';
import { useThemeContext } from '../context/ThemeContext';

const ModalForm = React.memo(({ 
  abierto, 
  titulo, 
  formData, 
  onFormChange, 
  onGuardar, 
  onCancelar,
  campos,
  loading = false,
  error = null,
  success = null
}) => {
  const { isDark } = useThemeContext();
  
  if (!abierto || !campos) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancelar}
      />
      
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl transition-all duration-300 transform animate-in zoom-in-95 ${
        isDark ? 'bg-slate-900 border border-white/10' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {titulo}
          </h2>
          <button 
            onClick={onCancelar}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {success}
            </div>
          )}

          {campos.map(campo => (
            <InputField
              key={campo.name}
              fieldName={campo.name}
              label={campo.label}
              value={formData[campo.name] || ''}
              onChange={onFormChange}
              type={campo.type}
              placeholder={campo.placeholder}
              disabled={loading}
              options={campo.options || []}
            />
          ))}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${isDark ? 'border-white/10' : 'border-slate-100'} flex gap-3`}>
          <button
            onClick={onCancelar}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
              isDark 
                ? 'bg-white/5 hover:bg-white/10 text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ModalForm;