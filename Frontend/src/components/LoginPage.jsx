import React, { useState } from 'react';
import { Scale, Eye, EyeOff, Sun, Moon, LogIn, User, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import Button from './ui/Button';
import Alert from './ui/Alert';
import { Field, Input } from './ui/Field';

export default function LoginPage() {
  const { login, loading, error, setError } = useAuth();
  const { isDark, toggleTheme } = useThemeContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [intentado, setIntentado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIntentado(true);
    if (!username.trim() || !password) return;
    await login(username, password);
  };

  const faltaUsuario = intentado && !username.trim();
  const faltaPassword = intentado && !password;

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_minmax(420px,520px)] bg-bg">
      {/* Panel de identidad (solo pantallas grandes) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-brand-solid text-white">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-10 w-10 rounded-lg bg-white/15">
            <Scale size={22} aria-hidden="true" />
          </div>
          <span className="text-lg font-semibold">Balanza</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Gestión de pesadas para básculas industriales</h2>
          <p className="mt-3 text-white/75">
            Lectura de balanza en tiempo real, registro de bruto y tara, carta de porte y capturas de cámaras en un solo lugar.
          </p>
        </div>
        <p className="text-sm text-white/60">© 2026 CicloIT</p>
      </div>

      {/* Formulario */}
      <div className="relative flex items-center justify-center px-5 py-12">
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-lg text-fg-muted hover:bg-surface-3"
          aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-lg bg-brand-solid text-white">
              <Scale size={22} aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold text-fg">Balanza</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-fg">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-fg-subtle">Ingresá con tu usuario y contraseña.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            <Field label="Usuario" error={faltaUsuario ? 'Ingresá tu usuario' : null}>
              {(a11y) => (
                <div className="relative">
                  <User size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    {...a11y}
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                    autoComplete="username"
                    autoFocus
                    className="h-11 pl-9"
                  />
                </div>
              )}
            </Field>

            <Field label="Contraseña" error={faltaPassword ? 'Ingresá tu contraseña' : null}>
              {(a11y) => (
                <div className="relative">
                  <KeyRound size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                  <Input
                    {...a11y}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    autoComplete="current-password"
                    className="h-11 pl-9 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-3"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}
            </Field>

            {error && <Alert tone="danger">{error}</Alert>}

            <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={loading} className="w-full justify-center">
              {loading ? 'Verificando...' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-10 text-center text-xs text-fg-subtle">Balanza · Sistema de gestión de pesadas</p>
        </div>
      </div>
    </div>
  );
}
