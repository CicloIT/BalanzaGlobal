import React, { useState } from 'react';
import { Server, KeyRound, Ban, Copy } from 'lucide-react';
import { Card, CardHeader, CardBody } from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { useToast, useConfirm } from '../context/feedback';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import { haceCuanto } from '../hooks/useSitioEstado';

const estadoDe = (sitio) => {
  if (!sitio?.sitio_activo) {
    return sitio?.tiene_token
      ? { tone: 'info', texto: 'Token generado, esperando el servidor' }
      : { tone: 'neutral', texto: 'Trabaja contra el central' };
  }
  return sitio.conectado
    ? { tone: 'success', texto: 'Servidor propio · conectado' }
    : { tone: 'warning', texto: 'Servidor propio · sin conexión' };
};

// Superadmin (central): servidores propios de cada localidad (modo sitio, v2).
export default function ServidoresSitio({ localidades, estado, onCambio }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [token, setToken] = useState(null);   // { localidad, token } recién generado
  const [ocupado, setOcupado] = useState(null);
  const sitios = new Map((estado?.sitios || []).map(s => [s.localidad_id, s]));

  const llamar = async (metodo, url) => {
    const res = await fetch(`${API_BASE_URL}${url}`, { method: metodo, headers: getAuthHeaders(null) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);
    return data.data;
  };

  const generar = async (loc) => {
    const sitio = sitios.get(loc.id);
    if (sitio?.tiene_token || sitio?.sitio_activo) {
      const ok = await confirm({
        title: `¿Regenerar el token de ${loc.nombre}?`,
        message: 'El servidor de la localidad se desconecta hasta que se cargue el token nuevo en su .env (SITIO_TOKEN).',
        confirmLabel: 'Regenerar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setOcupado(loc.id);
    try {
      const data = await llamar('POST', `/api/localidades/${loc.id}/sitio-token`);
      setToken({ localidad: loc, token: data.token });
      onCambio?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const revocar = async (loc, desactivar) => {
    const ok = await confirm({
      title: desactivar ? `¿Volver ${loc.nombre} al servidor central?` : `¿Revocar el token de ${loc.nombre}?`,
      message: desactivar
        ? 'La localidad deja de usar su servidor propio y vuelve a pesar contra el central. Lo que el servidor de la localidad no haya enviado todavía queda solo allá.'
        : 'El servidor de la localidad deja de sincronizar (sigue pesando sin conexión) hasta que se genere un token nuevo.',
      confirmLabel: desactivar ? 'Volver al central' : 'Revocar',
      tone: 'danger',
    });
    if (!ok) return;
    setOcupado(loc.id);
    try {
      await llamar('DELETE', `/api/localidades/${loc.id}/sitio-token${desactivar ? '?desactivar=1' : ''}`);
      toast.success(desactivar ? `${loc.nombre} vuelve a trabajar contra el central` : 'Token revocado');
      onCambio?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setOcupado(null);
    }
  };

  const textoEnv = token && [
    'MODO=sitio',
    `LOCALIDAD_ID=${token.localidad.id}`,
    `SITIO_TOKEN=${token.token}`,
    `CENTRAL_URL=wss://${window.location.host}/sitio`,
  ].join('\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoEnv);
      toast.success('Copiado');
    } catch {
      toast.error('No se pudo copiar: seleccioná el texto a mano');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader
        icon={Server}
        title="Servidores propios de las localidades"
        description="Cada localidad puede pesar en su propio servidor (sin depender de internet) y enviar todo al central."
      />
      <CardBody className="p-0">
        <ul className="divide-y divide-line">
          {localidades.map(loc => {
            const sitio = sitios.get(loc.id);
            const { tone, texto } = estadoDe(sitio);
            return (
              <li key={loc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{loc.nombre}</p>
                  {sitio?.sitio_activo && (
                    <p className="text-xs text-fg-subtle">
                      Última sincronización {haceCuanto(sitio.sitio_ultima_sync)}
                      {sitio.sitio_info?.version ? ` · v${sitio.sitio_info.version}` : ''}
                      {sitio.sitio_info?.hostname ? ` · ${sitio.sitio_info.hostname}` : ''}
                    </p>
                  )}
                </div>
                <Badge tone={tone} dot>{texto}</Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" icon={KeyRound} disabled={ocupado === loc.id} onClick={() => generar(loc)}>
                    {sitio?.tiene_token || sitio?.sitio_activo ? 'Regenerar token' : 'Generar token'}
                  </Button>
                  {sitio?.tiene_token && (
                    <Button size="sm" variant="ghost" icon={Ban} disabled={ocupado === loc.id} onClick={() => revocar(loc, false)}>
                      Revocar
                    </Button>
                  )}
                  {sitio?.sitio_activo && (
                    <Button size="sm" variant="danger-soft" disabled={ocupado === loc.id} onClick={() => revocar(loc, true)}>
                      Volver al central
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>

      {token && (
        <Modal
          title={`Token del servidor de ${token.localidad.nombre}`}
          subtitle="Se muestra una sola vez. Copialo en el .env del servidor de la localidad y reinicialo."
          icon={KeyRound}
          onClose={() => setToken(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setToken(null)}>Listo</Button>
              <Button icon={Copy} onClick={copiar}>Copiar</Button>
            </>
          )}
        >
          <pre className="whitespace-pre-wrap break-all rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-fg">{textoEnv}</pre>
          <p className="mt-3 text-xs text-fg-subtle">
            Si el central usa otro puerto público, ajustá CENTRAL_URL (por ejemplo wss://balanza.cicloit.com:63443/sitio).
          </p>
        </Modal>
      )}
    </Card>
  );
}
