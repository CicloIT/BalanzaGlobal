import React, { useState, useEffect } from 'react';
import { Database, Download, Play, CalendarClock, FileArchive, Cpu, HardDrive } from 'lucide-react';
import DispositivosConfig from './DispositivosConfig';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/feedback';
import { PERMISSIONS } from '../config/rolesConfig';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import PageHeader from './ui/PageHeader';
import { Card, CardHeader, CardBody } from './ui/Card';
import Button from './ui/Button';
import Alert from './ui/Alert';
import EmptyState from './ui/EmptyState';
import { LoadingState } from './ui/Spinner';
import { cx } from '../lib/cx';

function Respaldos() {
  const confirm = useConfirm();
  const toast = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/backup/list`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    const ok = await confirm({
      title: 'Crear respaldo',
      message: 'Se genera un respaldo completo de la base de datos y los archivos. Puede demorar unos segundos.',
      confirmLabel: 'Respaldar ahora',
    });
    if (!ok) return;

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`${API_BASE_URL}/api/backup/trigger`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(`Respaldo creado: ${data.filename}`);
        fetchBackups();
      } else {
        throw new Error(data.error || 'Error al crear respaldo');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      setDescargando(filename);
      const headers = getAuthHeaders(null);
      const res = await fetch(`${API_BASE_URL}/api/backup/download/${filename}`, {
        headers
      });

      if (!res.ok) throw new Error('No se pudo descargar el archivo');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDescargando(null);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 items-start">
      <div className="space-y-6">
        <Card>
          <CardHeader icon={Database} title="Respaldo manual" description="Base de datos y archivos completos" />
          <CardBody className="space-y-4">
            <Button variant="primary" icon={Play} onClick={handleCreateBackup} loading={creating} className="w-full justify-center">
              {creating ? 'Generando respaldo...' : 'Respaldar ahora'}
            </Button>
            {error && <Alert tone="danger" onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert tone="success" onClose={() => setSuccess(null)}>{success}</Alert>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={CalendarClock} title="Programación" tone="neutral" />
          <CardBody className="space-y-2 text-sm text-fg-muted">
            <p>El sistema hace un respaldo automático completo todos los <strong className="text-fg">domingos a las 03:00</strong>.</p>
            <p>Los archivos quedan en el servidor, en la carpeta <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-fg">/backups</code>.</p>
          </CardBody>
        </Card>
      </div>

      <Card className="lg:col-span-2 overflow-hidden">
        <CardHeader icon={FileArchive} title="Archivos de respaldo" description={backups.length ? `${backups.length} archivo${backups.length !== 1 ? 's' : ''}` : undefined} />
        {loading ? (
          <LoadingState texto="Cargando respaldos..." />
        ) : backups.length === 0 ? (
          <EmptyState icon={FileArchive} title="No hay respaldos generados aún" description="Creá uno manual o esperá al respaldo automático del domingo." />
        ) : (
          <ul className="divide-y divide-line max-h-[520px] overflow-y-auto">
            {backups.map((b, idx) => (
              <li key={idx} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <HardDrive size={18} className="text-fg-subtle shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-fg">{b.filename}</p>
                    <p className="text-xs text-fg-subtle tabular">{new Date(b.date).toLocaleString('es-AR')} · {formatSize(b.size)}</p>
                  </div>
                </div>
                <Button size="sm" icon={Download} onClick={() => handleDownload(b.filename)} loading={descargando === b.filename}>
                  Descargar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Configuracion() {
  const { hasPermission } = usePermissions();
  const { isGlobal } = useAuth();
  // Respaldo = base completa: solo admin global / superadmin
  const puedeRespaldar = hasPermission(PERMISSIONS.BACKUP_MANAGE) && isGlobal;
  const puedeDispositivos = hasPermission(PERMISSIONS.DISPOSITIVOS_MANAGE);

  const secciones = [
    puedeDispositivos && { id: 'dispositivos', label: 'Dispositivos', icon: Cpu, description: 'Balanza, agente local y grabadora de cámaras de cada localidad.' },
    puedeRespaldar && { id: 'respaldos', label: 'Respaldos', icon: Database, description: 'Copias de seguridad de la base de datos y los archivos.' },
  ].filter(Boolean);

  const [seccion, setSeccion] = useState(secciones[0]?.id);
  const actual = secciones.find(s => s.id === seccion) ?? secciones[0];

  if (!actual) {
    return <EmptyState title="No hay opciones de configuración disponibles para tu usuario" />;
  }

  return (
    <div>
      <PageHeader title="Configuración" description={actual.description} />

      {secciones.length > 1 && (
        <div role="tablist" aria-label="Secciones de configuración" className="mb-6 flex gap-1 border-b border-line">
          {secciones.map(({ id, label, icon: Icon }) => {
            const activa = actual.id === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setSeccion(id)}
                className={cx(
                  '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  activa ? 'border-brand-solid text-brand' : 'border-transparent text-fg-muted hover:text-fg hover:border-line-strong'
                )}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            );
          })}
        </div>
      )}

      {actual.id === 'dispositivos' && <DispositivosConfig />}
      {actual.id === 'respaldos' && <Respaldos />}
    </div>
  );
}
