import React from 'react';
import { useThemeContext } from '../context/ThemeContext';

const InputField = React.memo(({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
  fieldName = null,
  options = []
}) => {
  const { isDark } = useThemeContext();

  const handleChange = (e) => {
    const val = e.target.value;
    if (fieldName) {
      onChange(fieldName, val);
    } else {
      onChange(val);
    }
  };

  return (
    <div className="mb-4">
      <label className={`block text-sm font-semibold mb-2 transition-colors duration-300 ${
        isDark ? 'text-slate-300' : 'text-slate-700'
      } ${disabled ? 'opacity-50' : ''}`}>
        {label}
      </label>
      
      {type === "select" ? (
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
            isDark 
              ? 'bg-slate-800 border border-white/20 text-white' 
              : 'bg-white border border-slate-300 text-slate-900'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <option value="">Seleccionar...</option>
          {options.map((opt, i) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            return <option key={i} value={val}>{label}</option>;
          })}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
            isDark
              ? 'bg-white/10 border border-white/20 focus:border-white/30 text-white placeholder-slate-400'
              : 'bg-white border border-slate-300 focus:border-blue-400 text-slate-900 placeholder-slate-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      )}
    </div>
  );
});

export default InputField;