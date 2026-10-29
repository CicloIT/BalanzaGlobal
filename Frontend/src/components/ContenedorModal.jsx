import React, { useState, useEffect } from 'react';
import { Package, Save, ArrowRight } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Alert from './ui/Alert';
import { Field, Input } from './ui/Field';

const kg = (v) => `${Number(v).toLocaleString('es-AR')} kg`;

export default function ContenedorModal({ abierto, item, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    nro_contenedor: '',
    peso_vgm: '',
    tara_contenedor: '',
    cantidad_bultos: '',
    nro_proforma: '',
    nro_permiso_embarque: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (item) {
      setFormData({
        nro_contenedor:       item.nro_contenedor || '',
        peso_vgm:             item.peso_vgm ?? '',
        tara_contenedor:      item.tara_contenedor ?? '',
        cantidad_bultos:      item.cantidad_bultos ?? '',
        nro_proforma:         item.nro_proforma || '',
        nro_permiso_embarque: item.nro_permiso_embarque || '',
      });
      setError(null);
    }
  }, [item]);

  if (!abierto || !item) return null;

  const taraCont      = parseFloat(formData.tara_contenedor) || 0;
  const netoExistente = item.neto != null ? parseFloat(item.neto) : null;
  const nuevoBruto    = netoExistente != null && taraCont > 0 ? netoExistente + taraCont : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!formData.nro_contenedor.trim()) {
      setError('Nro de contenedor es obligatorio');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/pesadas/operacion/${item.operacion_id}/contenedor`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      size="lg"
      onClose={onClose}
      icon={Package}
      title="Datos de contenedor"
      subtitle={`Operación #${item.operacion_id} · ${item.vehiculo_patente}`}
      footer={(
        <>
          <Button onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" form="form-contenedor" variant="primary" icon={Save} loading={loading}>
            {loading ? 'Guardando...' : 'Guardar datos'}
          </Button>
        </>
      )}
    >
      <form id="form-contenedor" onSubmit={handleSave} className="space-y-5">
        {/* Vista previa del cálculo */}
        {netoExistente != null && (
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Pesos actuales → resultantes</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-fg-subtle">Bruto</p>
                <p className="font-mono font-semibold tabular text-fg">{item.bruto != null ? kg(item.bruto) : '—'}</p>
                {nuevoBruto != null && (
                  <p className="mt-0.5 flex items-center gap-1 font-mono font-semibold tabular text-brand">
                    <ArrowRight size={12} aria-hidden="true" />{kg(nuevoBruto)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Tara</p>
                <p className="font-mono font-semibold tabular text-fg">{item.tara != null ? kg(item.tara) : '—'}</p>
                {taraCont > 0 && (
                  <p className="mt-0.5 flex items-center gap-1 font-mono font-semibold tabular text-brand">
                    <ArrowRight size={12} aria-hidden="true" />{kg(taraCont)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Neto</p>
                <p className="font-mono font-semibold tabular text-fg">{kg(netoExistente)}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">Sin cambio</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nro. de contenedor" required className="md:col-span-2">
            <Input name="nro_contenedor" value={formData.nro_contenedor} onChange={handleChange} placeholder="MSCU1234567" className="font-mono" />
          </Field>
          <Field label="Tara del contenedor (kg)">
            <Input type="number" inputMode="decimal" name="tara_contenedor" value={formData.tara_contenedor} onChange={handleChange} placeholder="0" />
          </Field>
          <Field label="Peso VGM (kg)">
            <Input type="number" inputMode="decimal" name="peso_vgm" value={formData.peso_vgm} onChange={handleChange} placeholder="0" />
          </Field>
          <Field label="Cantidad de bultos">
            <Input type="number" inputMode="numeric" name="cantidad_bultos" value={formData.cantidad_bultos} onChange={handleChange} placeholder="0" />
          </Field>
          <Field label="Nro. de proforma">
            <Input name="nro_proforma" value={formData.nro_proforma} onChange={handleChange} placeholder="PLT-001" />
          </Field>
          <Field label="Nro. de permiso de embarque" className="md:col-span-2">
            <Input name="nro_permiso_embarque" value={formData.nro_permiso_embarque} onChange={handleChange} placeholder="PE-0000001" />
          </Field>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
