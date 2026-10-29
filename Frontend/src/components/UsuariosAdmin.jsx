import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, KeyRound, UserX, UserCheck, Search, X, Users, Save, Eye, EyeOff, ShieldCheck, BarChart3, Scale } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/feedback';
import { ROLE_LABELS } from '../config/navigation';
import { formatFecha } from '../lib/format';
import { cx } from '../lib/cx';
import PageHeader from './ui/PageHeader';
import { Card } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Alert from './ui/Alert';
import Modal from './ui/Modal';
import Segmented from './ui/Segmented';
import EmptyState from './ui/EmptyState';
import { LoadingState } from './ui/Spinner';
import { Field, Input, Select } from './ui/Field';
import { controlClass } from './ui/controlClass';

const MINIMO = 6;   // igual que PASSWORD_MIN del backend

const ROLES = [
  { value: 'balancero', icon: Scale, tone: 'brand', ayuda: 'Pesa con la balanza de una localidad.' },
  { value: 'logistica', icon: BarChart3, tone: 'info', ayuda: 'Solo ve el Dashboard de todas las localidades de su empresa.' },
  { value: 'superadmin', icon: ShieldCheck, tone: 'warning', ayuda: 'Administrador de toda la plataforma.' },
];
const rolInfo = (rol) => ROLES.find(r => r.value === rol) ?? { tone: 'neutral', icon: Users };

const pedir = async (path, opciones = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: getAuthHeaders(opciones.body ? undefined : null), ...opciones });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'Error en la petición');
  return data;
};

function alcanceDe(u) {
  if (u.rol === 'superadmin') return 'Toda la plataforma';
  if (u.localidad_nombre) return u.localidad_nombre;
  return u.empresa_nombre ? `${u.empresa_nombre} · todas las localidades` : 'Todas las localidades';
}

function rolBadge(rol) {
  const { tone, icon } = rolInfo(rol);
  return <Badge tone={ROLE_LABELS[rol] ? tone : 'neutral'} icon={icon}>{ROLE_LABELS[rol] ?? `${rol} (rol eliminado)`}</Badge>;
}

/* ─── Alta / edición ──────────────────────────────────────────────────────── */
function UsuarioForm({ usuario, esPropio, reactivar = false, localidades, empresas, onClose, onSaved }) {
  const toast = useToast();
  const editando = Boolean(usuario);
  const [username, setUsername] = useState(usuario?.username ?? '');
  // Un usuario con rol eliminado (admin, gerente...) se reactiva eligiendo un rol vigente
  const [rol, setRol] = useState(ROLE_LABELS[usuario?.rol] ? usuario.rol : 'balancero');
  const [localidadId, setLocalidadId] = useState(usuario?.localidad_id ? String(usuario.localidad_id) : '');
  const [empresaId, setEmpresaId] = useState(usuario?.empresa_id ? String(usuario.empresa_id) : (empresas.length === 1 ? String(empresas[0].id) : ''));
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const errores = {
    username: !editando && !/^[a-zA-Z0-9._-]{3,}$/.test(username.trim())
      ? 'Mínimo 3 caracteres: letras, números, punto, guion o guion bajo' : null,
    localidad: rol === 'balancero' && !localidadId ? 'Elegí la localidad del balancero' : null,
    empresa: rol === 'logistica' && !empresaId ? 'Elegí la empresa' : null,
    password: !editando && password.length < MINIMO ? `Mínimo ${MINIMO} caracteres` : null,
    confirmar: !editando && confirmar !== password ? 'No coincide con la contraseña' : null,
  };
  const hayErrores = Object.values(errores).some(Boolean);

  const guardar = async (e) => {
    e.preventDefault();
    setIntentado(true);
    setError(null);
    if (hayErrores) return;
    const body = {
      rol,
      localidad_id: rol === 'balancero' ? Number(localidadId) : null,
      empresa_id: rol === 'logistica' ? Number(empresaId) : undefined,
      ...(reactivar && { activo: true }),
    };
    try {
      setGuardando(true);
      if (editando) {
        await pedir(`/api/usuarios/${usuario.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast.success(`Usuario ${usuario.username} ${reactivar ? 'reactivado' : 'actualizado'}`);
      } else {
        await pedir('/api/usuarios', { method: 'POST', body: JSON.stringify({ ...body, username: username.trim(), password }) });
        toast.success(`Usuario ${username.trim()} creado`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const tipo = ver ? 'text' : 'password';

  return (
    <Modal
      size="md"
      onClose={onClose}
      icon={editando ? Pencil : Plus}
      title={reactivar ? `Reactivar ${usuario.username}` : editando ? `Editar ${usuario.username}` : 'Nuevo usuario'}
      subtitle={reactivar ? 'Su rol anterior ya no existe: elegí uno vigente' : undefined}
      footer={(
        <>
          <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="form-usuario" variant="primary" icon={Save} loading={guardando}>
            {guardando ? 'Guardando...' : reactivar ? 'Reactivar' : editando ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      )}
    >
      <form id="form-usuario" onSubmit={guardar} noValidate className="space-y-5">
        {!editando && (
          <Field label="Usuario" required hint="Con este nombre inicia sesión." error={intentado ? errores.username : null}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder="ej: balancero_quines" />
          </Field>
        )}

        <fieldset disabled={esPropio}>
          <legend className="mb-1.5 text-sm font-medium text-fg">Rol <span className="text-danger" aria-hidden="true">*</span></legend>
          <div className="grid gap-2">
            {ROLES.map(({ value, icon: Icon, ayuda }) => {
              const activo = rol === value;
              return (
                <label
                  key={value}
                  className={cx(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                    activo ? 'border-brand-solid bg-brand-soft' : 'border-line hover:bg-surface-2',
                    esPropio && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <input type="radio" name="rol" value={value} checked={activo} onChange={() => setRol(value)} className="mt-1 accent-[var(--brand-solid)]" />
                  <Icon size={18} aria-hidden="true" className={cx('mt-0.5 shrink-0', activo ? 'text-brand' : 'text-fg-subtle')} />
                  <span>
                    <span className="block text-sm font-medium text-fg">{ROLE_LABELS[value]}</span>
                    <span className="block text-xs text-fg-subtle">{ayuda}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {esPropio && <p className="mt-1.5 text-xs text-fg-subtle">No podés cambiarte el rol a vos mismo.</p>}
        </fieldset>

        {rol === 'balancero' && (
          <Field label="Localidad" required error={intentado ? errores.localidad : null}>
            <Select value={localidadId} onChange={(e) => setLocalidadId(e.target.value)}>
              <option value="">Elegir localidad...</option>
              {localidades.map(l => <option key={l.id} value={l.id}>{l.nombre}{l.empresa_nombre && empresas.length > 1 ? ` (${l.empresa_nombre})` : ''}</option>)}
            </Select>
          </Field>
        )}
        {rol === 'logistica' && (
          <Field label="Empresa" required hint="Ve las métricas de todas sus localidades." error={intentado ? errores.empresa : null}>
            <Select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">Elegir empresa...</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Select>
          </Field>
        )}

        {!editando && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contraseña" required hint={`Mínimo ${MINIMO} caracteres`} error={intentado ? errores.password : null}>
              <Input type={tipo} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Repetir contraseña" required error={intentado ? errores.confirmar : null}>
              <Input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button size="sm" variant="ghost" icon={ver ? EyeOff : Eye} onClick={() => setVer(v => !v)} aria-pressed={ver} className="sm:col-span-2 w-fit">
              {ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            </Button>
          </div>
        )}

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}

/* ─── Reset de contraseña ─────────────────────────────────────────────────── */
function ResetPassword({ usuario, onClose }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const errores = {
    password: password.length < MINIMO ? `Mínimo ${MINIMO} caracteres` : null,
    confirmar: confirmar !== password ? 'No coincide con la contraseña' : null,
  };

  const guardar = async (e) => {
    e.preventDefault();
    setIntentado(true);
    setError(null);
    if (errores.password || errores.confirmar) return;
    try {
      setGuardando(true);
      await pedir(`/api/usuarios/${usuario.id}`, { method: 'PUT', body: JSON.stringify({ password }) });
      toast.success(`Contraseña de ${usuario.username} cambiada`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const tipo = ver ? 'text' : 'password';
  return (
    <Modal
      size="sm"
      onClose={onClose}
      icon={KeyRound}
      title="Resetear contraseña"
      subtitle={usuario.username}
      footer={(
        <>
          <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="form-reset" variant="primary" icon={Save} loading={guardando}>Guardar</Button>
        </>
      )}
    >
      <form id="form-reset" onSubmit={guardar} noValidate className="space-y-4">
        <p className="text-sm text-fg-muted">La contraseña actual deja de funcionar. Pasale la nueva al usuario; puede cambiarla después desde su menú.</p>
        <Field label="Contraseña nueva" hint={`Mínimo ${MINIMO} caracteres`} error={intentado ? errores.password : null}>
          <Input type={tipo} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repetir contraseña" error={intentado ? errores.confirmar : null}>
          <Input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button size="sm" variant="ghost" icon={ver ? EyeOff : Eye} onClick={() => setVer(v => !v)} aria-pressed={ver}>
          {ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}

/* ─── Pantalla ────────────────────────────────────────────────────────────── */
export default function UsuariosAdmin() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [usuarios, setUsuarios] = useState([]);
  const [localidades, setLocalidades] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estado, setEstado] = useState('activos');
  const [busqueda, setBusqueda] = useState('');
  const [formulario, setFormulario] = useState(null);   // { usuario? } abierto
  const [reset, setReset] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [u, l, e] = await Promise.all([
        pedir('/api/usuarios?incluir_inactivos=1'),
        pedir('/api/localidades').catch(() => ({ data: [] })),
        pedir('/api/empresas').catch(() => ({ data: [] })),
      ]);
      setUsuarios(u.data);
      setLocalidades(l.data);
      setEmpresas(e.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarActivo = async (u, activar) => {
    if (!activar) {
      const ok = await confirm({
        title: `Desactivar ${u.username}`,
        message: 'No va a poder iniciar sesión. Su historial se conserva y se puede reactivar cuando quieras.',
        confirmLabel: 'Desactivar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      if (activar) await pedir(`/api/usuarios/${u.id}`, { method: 'PUT', body: JSON.stringify({ activo: true }) });
      else await pedir(`/api/usuarios/${u.id}`, { method: 'DELETE' });
      toast.success(`${u.username} ${activar ? 'reactivado' : 'desactivado'}`);
      cargar();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const visibles = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return usuarios
      .filter(u => estado === 'todos' || (estado === 'activos' ? u.activo : !u.activo))
      .filter(u => !t || [u.username, ROLE_LABELS[u.rol] ?? u.rol, alcanceDe(u)].some(v => v.toLowerCase().includes(t)));
  }, [usuarios, estado, busqueda]);

  const cuenta = {
    activos: usuarios.filter(u => u.activo).length,
    inactivos: usuarios.filter(u => !u.activo).length,
  };

  const renderAcciones = (u) => {
    const propio = u.id === user?.id;
    const rolVigente = Boolean(ROLE_LABELS[u.rol]);
    return (
      <div className="flex flex-wrap md:flex-nowrap justify-end gap-1">
        {u.activo ? (
          <>
            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setFormulario({ usuario: u })}>Editar</Button>
            <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setReset(u)}>Contraseña</Button>
            {!propio && (
              <Button size="sm" variant="ghost" icon={UserX} onClick={() => cambiarActivo(u, false)} className="hover:!text-danger hover:!bg-danger-soft">
                Desactivar
              </Button>
            )}
          </>
        ) : (
          <Button
            size="sm"
            variant="soft"
            icon={UserCheck}
            onClick={() => (rolVigente ? cambiarActivo(u, true) : setFormulario({ usuario: u, reactivar: true }))}
          >
            Reactivar
          </Button>
        )}
      </div>
    );
  };


  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Quién puede entrar al sistema, con qué rol y en qué localidad."
        meta={!loading && <Badge>{cuenta.activos} activo{cuenta.activos !== 1 ? 's' : ''} · {cuenta.inactivos} desactivado{cuenta.inactivos !== 1 ? 's' : ''}</Badge>}
        actions={<Button variant="primary" icon={Plus} onClick={() => setFormulario({})}>Nuevo usuario</Button>}
      />

      {error && <Alert tone="danger" className="mb-4" onClose={() => setError(null)}>{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
          <Segmented
            value={estado}
            onChange={setEstado}
            options={[
              { value: 'activos', label: `Activos (${cuenta.activos})` },
              { value: 'inactivos', label: `Desactivados (${cuenta.inactivos})` },
              { value: 'todos', label: 'Todos' },
            ]}
          />
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por usuario, rol o localidad..."
              aria-label="Buscar usuarios"
              className={cx(controlClass, 'pl-9 pr-9')}
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-fg-subtle hover:text-fg">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingState texto="Cargando usuarios..." />
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={Users}
            title={busqueda ? `Sin resultados para "${busqueda}"` : estado === 'inactivos' ? 'No hay usuarios desactivados' : 'No hay usuarios'}
          />
        ) : (
          <>
            {/* Móvil */}
            <ul className="md:hidden divide-y divide-line">
              {visibles.map(u => (
                <li key={u.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-fg truncate">
                        {u.username}{u.id === user?.id && <span className="ml-1.5 text-xs text-fg-subtle">(vos)</span>}
                      </p>
                      <p className="text-xs text-fg-subtle">{alcanceDe(u)}</p>
                    </div>
                    {rolBadge(u.rol)}
                  </div>
                  {!u.activo && <Badge tone="neutral">Desactivado</Badge>}
                  {renderAcciones(u)}
                </li>
              ))}
            </ul>

            {/* Escritorio */}
            <div className="hidden md:block relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="border-b border-line">
                    {['Usuario', 'Rol', 'Alcance', 'Estado', 'Alta'].map(h => (
                      <th key={h} scope="col" className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">{h}</th>
                    ))}
                    <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-subtle">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(u => (
                    <tr key={u.id} className={cx('border-b border-line last:border-b-0 hover:bg-surface-2', !u.activo && 'text-fg-subtle')}>
                      <td className="px-4 py-2.5 font-medium text-fg">
                        {u.username}{u.id === user?.id && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(vos)</span>}
                      </td>
                      <td className="px-4 py-2.5">{rolBadge(u.rol)}</td>
                      <td className="px-4 py-2.5 text-fg-muted">{alcanceDe(u)}</td>
                      <td className="px-4 py-2.5">
                        {u.activo ? <Badge tone="success" dot>Activo</Badge> : <Badge tone="neutral">Desactivado</Badge>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-fg-subtle tabular whitespace-nowrap">{formatFecha(u.created_at)}</td>
                      <td className="px-4 py-2">{renderAcciones(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {formulario && (
        <UsuarioForm
          usuario={formulario.usuario}
          esPropio={formulario.usuario?.id === user?.id}
          reactivar={formulario.reactivar}
          localidades={localidades}
          empresas={empresas}
          onClose={() => setFormulario(null)}
          onSaved={cargar}
        />
      )}
      {reset && <ResetPassword usuario={reset} onClose={() => setReset(null)} />}
    </div>
  );
}
