import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';

export default function LoginPage() {
  const { login, loading, error, setError } = useAuth();
  const { isDark, toggleTheme } = useThemeContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-500 ${
      isDark
        ? 'bg-linear-to-br from-slate-900 via-slate-800 to-slate-900'
        : 'bg-linear-to-br from-blue-50 via-white to-cyan-50'
    }`}>
      {/* Fondo decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl animate-pulse ${isDark ? 'bg-blue-500/15' : 'bg-blue-200/40'}`} />
        <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl animate-pulse ${isDark ? 'bg-cyan-500/15' : 'bg-cyan-200/40'}`} style={{ animationDelay: '2s' }} />
        <div className={`absolute top-1/2 left-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-100/60'}`} style={{ animationDelay: '1s' }} />
      </div>

      {/* Botón modo oscuro */}
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2.5 rounded-xl transition-all duration-300 z-10 ${
          isDark ? 'bg-white/10 hover:bg-white/20 text-yellow-400' : 'bg-white/80 hover:bg-white text-slate-700 shadow-md'
        }`}
        title={isDark ? 'Modo claro' : 'Modo oscuro'}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      {/* Card de login */}
      <div className={`relative z-10 w-full max-w-md mx-6 rounded-[2.5rem] p-10 transition-all duration-500 ${
        isDark
          ? 'bg-slate-900/60 border border-white/10 backdrop-blur-2xl shadow-2xl shadow-black/40'
          : 'bg-white/90 border border-slate-200/60 backdrop-blur-xl shadow-2xl shadow-slate-300/30'
      }`}>

        {/* Logo / título */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">⚖️</div>
          <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Sistema de Pesaje
          </h1>
          <p className={`text-sm mt-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Ingresá tus credenciales para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo usuario */}
          <div>
            <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              placeholder="admin / balancero"
              autoComplete="username"
              required
              className={`w-full px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-200 outline-none border-2 ${
                isDark
                  ? 'bg-slate-800/60 border-white/10 text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10'
              }`}
            />
          </div>

          {/* Campo contraseña */}
          <div>
            <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className={`w-full px-5 py-4 pr-14 rounded-2xl text-sm font-bold transition-all duration-200 outline-none border-2 ${
                  isDark
                    ? 'bg-slate-800/60 border-white/10 text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-500/10'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 text-lg transition-opacity hover:opacity-70`}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={`px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 animate-shake ${
              isDark ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className={`w-full py-4 rounded-2xl font-black text-white text-base tracking-wide transition-all duration-300 mt-2 ${
              loading || !username || !password
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verificando...
              </span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className={`text-center text-xs mt-8 font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          Sistema de Gestión de Balanza v1.0
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
