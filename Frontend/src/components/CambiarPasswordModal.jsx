import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Save } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import { useToast } from '../context/feedback';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Alert from './ui/Alert';
import { Field, Input } from './ui/Field';

const MINIMO = 6;   // igual que PASSWORD_MIN del backend

// Cambio de la propia contraseña (PUT /api/usuarios/me/password)
export default function CambiarPasswordModal({ onClose }) {
  const toast = useToast();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const errores = {
    actual: !actual ? 'Ingresá tu contraseña actual' : null,
    nueva: nueva.length < MINIMO
      ? `Tiene que tener al menos ${MINIMO} caracteres`
      : nueva === actual ? 'Tiene que ser distinta de la actual' : null,
    confirmar: confirmar !== nueva ? 'No coincide con la nueva contraseña' : null,
  };
  const hayErrores = Object.values(errores).some(Boolean);

  const guardar = async (e) => {
    e.preventDefault();
    setIntentado(true);
    setError(null);
    if (hayErrores) return;
    try {
      setGuardando(true);
      const res = await fetch(`${API_BASE_URL}/api/usuarios/me/password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ actual, nueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo cambiar la contraseña');
      toast.success('Contraseña actualizada');
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
      title="Cambiar contraseña"
      subtitle="Se aplica a tu usuario"
      footer={(
        <>
          <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="form-password" variant="primary" icon={Save} loading={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      )}
    >
      <form id="form-password" onSubmit={guardar} noValidate className="space-y-4">
        <Field label="Contraseña actual" error={intentado ? errores.actual : null}>
          <Input type={tipo} value={actual} onChange={(e) => { setActual(e.target.value); setError(null); }} autoComplete="current-password" />
        </Field>
        <Field label="Contraseña nueva" hint={`Mínimo ${MINIMO} caracteres`} error={intentado ? errores.nueva : null}>
          <Input type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repetir contraseña nueva" error={intentado ? errores.confirmar : null}>
          <Input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button size="sm" variant="ghost" icon={ver ? EyeOff : Eye} onClick={() => setVer(v => !v)} aria-pressed={ver}>
          {ver ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
