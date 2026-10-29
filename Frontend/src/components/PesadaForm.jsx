import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  Scale, Camera, RefreshCw, Monitor, FileText, Lock, ArrowDown, ArrowUp, Hand,
  Truck, ClipboardList, FileUp, X, AlertTriangle, CheckCircle2, WifiOff, Clock, Package, AlertCircle,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/feedback';
import SearchableSelect from './SearchableSelect';
import PageHeader from './ui/PageHeader';
import { Card, CardHeader, CardBody } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Alert from './ui/Alert';
import Modal from './ui/Modal';
import Spinner from './ui/Spinner';
import { Field, Input, Select } from './ui/Field';
import { cx } from '../lib/cx';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';

const getFriendlyError = (msg = '') => {
  const m = msg.toLowerCase();

  if (m.includes('chofer_id')) {
    return 'Debe seleccionar un chofer';
  }

  if (m.includes('producto_id')) {
    return 'Debe seleccionar un producto';
  }

  if (m.includes('productor_id')) {
    return 'Debe seleccionar un productor';
  }

  if (m.includes('transporte_id')) {
    return 'Debe seleccionar un transporte';
  }

  if (m.includes('vehiculo_patente')) {
    return 'Debe ingresar una patente válida';
  }

  if (m.includes('sentido')) {
    return 'Error en el sentido de carga (Ingreso/Salida)';
  }

  if (m.includes('faltan campos')) {
    return 'Faltan campos requeridos para registrar la pesada';
  }

  if (m.includes('peso')) {
    return 'El peso ingresado no es válido';
  }

  return 'Ocurrió un error al registrar la pesada';
};

const ErrorModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Revisá la operación"
      icon={AlertCircle}
      footer={<Button variant="primary" onClick={onClose} data-autofocus>Entendido</Button>}
    >
      <p className="text-sm text-fg-muted">{message}</p>
    </Modal>
  );
};

// El backend identifica al usuario por la cookie de sesión y solo envía el peso de la balanza pedida (si está en su alcance)
const getWsUrl = (dispositivoId) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const params = new URLSearchParams();
  if (dispositivoId) params.set('dispositivoId', dispositivoId);
  return `${protocol}//${host}/ws?${params}`;
};

/* ─── Lectura de la balanza (aislada para que el peso no re-renderice el formulario) ─── */
const BalanzaDisplay = memo(({ weightRef, statusRef, stableRef, dispositivoId, onEstado }) => {
  const [peso, setPeso] = useState(0);
  const [status, setStatus] = useState('DISCONNECTED');
  const [estable, setEstable] = useState(false);
  const [errorBalanza, setErrorBalanza] = useState(null);
  const wsRef = useRef(null);

  // Avisar al formulario solo cuando cambia conexión/estabilidad (no en cada peso)
  useEffect(() => {
    onEstado?.({ status, estable });
  }, [status, estable, onEstado]);

  useEffect(() => {
    let cerrado = false;
    let reconnectTimer = null;

    const connectWS = () => {
      const socket = new WebSocket(getWsUrl(dispositivoId));
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('[BalanzaDisplay] Conectado');
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (dispositivoId && data.dispositivo_id && data.dispositivo_id !== dispositivoId) return;
        if (data.type === 'STATUS') {
          setStatus(data.status);
          statusRef.current = data.status;
          setErrorBalanza(data.error || null);
          if (data.status !== 'CONNECTED' || 'stable' in data) {
            const st = data.status === 'CONNECTED' && data.stable === true;
            setEstable(st);
            stableRef.current = st;
          }
          // El STATUS inicial trae currentWeight (null si la balanza aún no envió peso)
          if ('currentWeight' in data) {
            setPeso(data.currentWeight ?? 0);
            weightRef.current = data.currentWeight ?? 0;
          }
        } else if (data.type === 'WEIGHT') {
          setPeso(data.weight);
          weightRef.current = data.weight;
          setEstable(data.stable === true);
          stableRef.current = data.stable === true;
        }
      };

      socket.onclose = () => {
        setStatus('DISCONNECTED');
        statusRef.current = 'DISCONNECTED';
        setEstable(false);
        stableRef.current = false;
        setErrorBalanza('Sin conexión con el servidor');
        if (cerrado) return;
        console.log('[BalanzaDisplay] Desconectado. Reintentando en 3s...');
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.log('[BalanzaDisplay] Error WS:', err);
        socket.close();
      };
    };

    connectWS();
    return () => {
      cerrado = true;
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [weightRef, statusRef, stableRef, dispositivoId]);

  const conectada = status === 'CONNECTED';
  const estado = !conectada
    ? { tone: 'danger', icon: WifiOff, texto: 'Desconectada' }
    : estable
      ? { tone: 'success', icon: CheckCircle2, texto: 'Peso estable' }
      : { tone: 'warning', icon: Clock, texto: 'Inestable — esperar' };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Lectura en tiempo real</span>
        <Badge tone={estado.tone} icon={estado.icon}>{estado.texto}</Badge>
      </div>
      <div
        className={cx(
          'rounded-xl border px-4 py-5 text-center transition-colors',
          !conectada ? 'border-line bg-surface-2'
            : estable ? 'border-success/40 bg-success-soft' : 'border-warning/40 bg-warning-soft'
        )}
        aria-live="off"
      >
        <output
          aria-live="off"
          className={cx('block font-mono font-bold tabular leading-none text-5xl sm:text-6xl', conectada ? 'text-fg' : 'text-fg-subtle')}
          aria-label={`Peso actual ${peso.toLocaleString('es-AR')} kilogramos`}
        >
          {peso.toLocaleString('es-AR')}
          <span className="ml-2 text-xl font-semibold text-fg-subtle">kg</span>
        </output>
      </div>
      {!conectada && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-danger">
          <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
          {errorBalanza || 'La balanza no está enviando datos'}
        </p>
      )}
    </div>
  );
});

const FORM_INICIAL = {
  vehiculo_patente: '',
  chofer_id: '',
  producto_id: '',
  productor_id: '',
  transporte_id: '',
  balancero: '',
  peso: '',
  nro_remito: '',
  sentido: 'INGRESO',
  es_contenedor: false,
};

export default function PesadaForm({ transportes: transportesProp, choferes: choferesProp, productos: productosProp, productores: productoresProp, onPesadaCreated }) {
  const { canEnterManualWeight } = usePermissions();
  const { isGlobal } = useAuth();
  const toast = useToast();
  const [errorModal, setErrorModal] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productores, setProductores] = useState([]);
  const [transportes, setTransportes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balanzas, setBalanzas] = useState([]);
  const [dispositivoId, setDispositivoId] = useState(null);
  const [estadoBalanza, setEstadoBalanza] = useState({ status: 'DISCONNECTED', estable: false });
  const [arrastrando, setArrastrando] = useState(false);

  // Localidad de trabajo = la de la balanza elegida. Un usuario global la envía en cada request;
  // para un usuario local el backend usa siempre la suya.
  const localidadId = balanzas.find(b => b.id === dispositivoId)?.localidad_id ?? null;
  const withLocalidad = useCallback((url) => {
    if (!isGlobal || !localidadId) return url;
    return `${url}${url.includes('?') ? '&' : '?'}localidad_id=${localidadId}`;
  }, [isGlobal, localidadId]);

  // Refs para capturar peso sin disparar re-renders del form entero constantemente
  const currentWeightRef = useRef(0);
  const currentStatusRef = useRef('DISCONNECTED');
  const currentStableRef = useRef(false);
  const capturedWeightRef = useRef(null);   // peso tomado de la balanza con el botón Capturar

  const [camLoading, setCamLoading] = useState(false);
  const [camImages, setCamImages] = useState([]);
  const [camStatus, setCamStatus] = useState(null);
  const [activeChannels, setActiveChannels] = useState([1, 2, 3]);
  // Módulo de cámaras fuera del plan de la localidad: el panel se muestra bloqueado y no se piden fotos
  const [camBloqueado, setCamBloqueado] = useState(false);

  const [formData, setFormData] = useState(FORM_INICIAL);
  const [archivoPDF, setArchivoPDF] = useState(null);
  const fileInputRef = useRef(null);

  const [pesadaActiva, setPesadaActiva] = useState(null);

  // Auto-completar datos si hay una pesada abierta para la patente
  useEffect(() => {
    if (formData.vehiculo_patente.trim().length >= 6) {
      const fetchActiva = async () => {
        try {
          const res = await fetch(withLocalidad(`${API_BASE_URL}/api/pesadas/activa/${formData.vehiculo_patente}`), {
            headers: getAuthHeaders(null)
          });
          const data = await res.json();
          if (data.success && data.data) {
            setPesadaActiva(data.data);
            // Auto-completar campos de maestro
            setFormData(prev => ({
              ...prev,
              chofer_id: data.data.chofer_nombre || data.data.chofer_id || '',
              producto_id: data.data.producto_nombre || data.data.producto_id || '',
              productor_id: data.data.productor_nombre || data.data.productor_id || '',
              transporte_id: data.data.transporte_nombre || data.data.transporte_id || '',
              sentido: data.data.sentido || 'INGRESO',
              es_contenedor: data.data.es_contenedor || false,
            }));
          } else {
            setPesadaActiva(null);
          }
        } catch (e) { console.error(e); }
      };

      const timeout = setTimeout(fetchActiva, 600);
      return () => clearTimeout(timeout);
    }
  }, [formData.vehiculo_patente, withLocalidad]);

  // Balanzas disponibles: una para usuarios locales, todas las de la empresa para usuarios globales
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/config/balanzas`, { headers: getAuthHeaders(null) });
        const data = await res.json();
        if (data.success && data.data?.length) {
          setBalanzas(data.data);
          setDispositivoId(prev => prev ?? data.data[0].id);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    // Usuario global: esperar a conocer la balanza (y su localidad) antes de cargar catálogos
    if (isGlobal && !localidadId) return;

    const cargarDatos = async () => {
      try {
        setLoading(true);
        const endpoints = {
          vehiculos: `${API_BASE_URL}/api/vehiculos/select-list`,
          choferes: `${API_BASE_URL}/api/choferes`,
          productos: `${API_BASE_URL}/api/productos`,
          productores: `${API_BASE_URL}/api/productores`,
          transportes: `${API_BASE_URL}/api/transportes`,
        };

        const keys = Object.keys(endpoints);
        const responses = await Promise.all(
          Object.values(endpoints).map(async (url) => {
            const res = await fetch(withLocalidad(url), { headers: getAuthHeaders(null) });
            if (!res.ok) {
              const errorText = await res.text();
              console.error(`Error en fetch a ${url}:`, errorText);
            }
            return res;
          })
        );

        const dataResults = {};
        for (let i = 0; i < responses.length; i++) {
          const key = keys[i];
          const res = responses[i];
          if (res.ok) dataResults[key] = await res.json();
        }

        setVehiculos(dataResults.vehiculos?.data || []);
        setChoferes(dataResults.choferes?.data || []);
        setProductos(dataResults.productos?.data || []);
        setProductores(dataResults.productores?.data || []);
        setTransportes(dataResults.transportes?.data || []);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();

    // Cargar config cámaras
    (async () => {
      try {
        const res = await fetch(withLocalidad(`${API_BASE_URL}/api/camaras/config`), { headers: getAuthHeaders(null) });
        const data = await res.json();
        setCamBloqueado(data.code === 'MODULO_CAMARAS_DESHABILITADO');
        if (data.success && data.canales) setActiveChannels(data.canales);
      } catch { /* ignore */ }
    })();
  }, [isGlobal, localidadId, withLocalidad]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'peso' && !canEnterManualWeight()) return;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, [canEnterManualWeight]);

  const elegirPDF = useCallback((file) => {
    if (file && file.type === 'application/pdf') {
      setArchivoPDF(file);
    } else {
      setArchivoPDF(null);
      if (file) toast.error('Solo se permiten archivos PDF');
    }
  }, [toast]);

  const handleFileChange = useCallback((e) => elegirPDF(e.target.files[0]), [elegirPDF]);

  const quitarPDF = () => {
    setArchivoPDF(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCapture = useCallback((peso) => {
    capturedWeightRef.current = peso;
    setFormData(prev => ({ ...prev, peso: peso.toString() }));
    toast.success(`Peso capturado: ${Number(peso).toLocaleString('es-AR')} kg`, 2500);
  }, [toast]);

  const capturarPesoBalanza = () => {
    if (currentStatusRef.current !== 'CONNECTED') return;
    if (!currentStableRef.current) {
      setErrorModal('El peso todavía no está estable. Espere a que el camión quede quieto sobre la balanza.');
      return;
    }
    handleCapture(currentWeightRef.current);
  };

  const capturarFotos = async (patente) => {
    if (camBloqueado) return [];
    try {
      setCamLoading(true);
      setCamStatus('capturing');
      const res = await fetch(withLocalidad(`${API_BASE_URL}/api/camaras/capturar-todo?patente=${encodeURIComponent(patente)}`), {
        headers: getAuthHeaders(null)
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setCamImages(data.archivos || []);
        setCamStatus('success');
        return data.archivos || [];
      } else if (data.status === 'modulo_deshabilitado') {
        setCamBloqueado(true);
        setCamStatus(null);
        return [];
      } else {
        setCamStatus('sin_camaras');
        return [];
      }
    } catch {
      setCamStatus('sin_camaras');
      return [];
    } finally {
      setCamLoading(false);
    }
  };

  const registrarPesada = async () => {
    if (!formData.peso || parseFloat(formData.peso) <= 0) {
      setErrorModal('Por favor ingresa un peso válido');
      return;
    }
    if (!formData.vehiculo_patente.trim()) {
      setErrorModal('La patente es obligatoria');
      return;
    }
    const sentidoFinal = pesadaActiva ? pesadaActiva.sentido : formData.sentido;
    if (!sentidoFinal) {
      setErrorModal('Debe seleccionar si es Ingreso o Salida');
      return;
    }
    if (!dispositivoId) {
      setErrorModal('No hay una balanza configurada para su localidad');
      return;
    }

    // Es manual si el peso no salió del botón Capturar (el backend además verifica que la balanza lo haya marcado)
    const pesoIngresado = formData.peso.toString();
    const esManual = capturedWeightRef.current === null || pesoIngresado !== capturedWeightRef.current.toString();

    if (esManual && !canEnterManualWeight()) {
      setErrorModal('No tiene permiso para cargar peso manualmente.');
      return;
    }

    try {
      setLoading(true);

      // Solo capturar fotos si no hay pesada activa con fotos operacion_id
      // o si es una pesada nueva (BRUTO sin operacion previa)
      let fotosCapturadas = [];

      fotosCapturadas = await capturarFotos(formData.vehiculo_patente);

      // Mapear nombres a IDs si es necesario (para datalists)
      const findId = (list, val, nameAttr = 'nombre') => {
        if (!val) return null;
        const found = list.find(x => x[nameAttr] === val || x.id == val || x.apellido_nombre === val);
        return found ? found.id : null;
      };

      // Lo creado se agrega a la lista local: si este intento falla después, el reintento
      // lo encuentra en vez de volver a crearlo (chofer duplicado → error, producto duplicado)
      const createEntityIfMissing = async (endpoint, payload, agregar) => {
        try {
          const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: getAuthHeaders('application/json'),
            body: JSON.stringify(isGlobal ? { ...payload, localidad_id: localidadId } : payload)
          });
          const data = await res.json();
          if (!(data.success && data.data)) return null;
          agregar?.(prev => [...prev, data.data]);
          return data.data.id;
        } catch { return null; }
      };

      const vehiculoExiste = vehiculos.find(v => v.patente === formData.vehiculo_patente);
      if (!vehiculoExiste && formData.vehiculo_patente) {
        await createEntityIfMissing('/api/vehiculos', {
          patente: formData.vehiculo_patente,
          tipo_vehiculo: 'OTRO',
        }, setVehiculos);
      }

      let cId = findId(choferes, formData.chofer_id, 'apellido_nombre');
      if (!cId && formData.chofer_id) {
        cId = await createEntityIfMissing('/api/choferes', { apellido_nombre: formData.chofer_id }, setChoferes);
      }

      let pId = findId(productos, formData.producto_id);
      if (!pId && formData.producto_id) {
        pId = await createEntityIfMissing('/api/productos', { nombre: formData.producto_id }, setProductos);
      }

      let prId = findId(productores, formData.productor_id);
      if (!prId && formData.productor_id) {
        prId = await createEntityIfMissing('/api/productores', { nombre: formData.productor_id }, setProductores);
      }

      let tId = findId(transportes, formData.transporte_id);
      if (!tId && formData.transporte_id) {
        tId = await createEntityIfMissing('/api/transportes', { nombre: formData.transporte_id, cuit: '0' }, setTransportes);
      }

      const d = new FormData();
      d.append('vehiculo_patente', formData.vehiculo_patente);
      d.append('sentido', sentidoFinal);
      d.append('peso', parseFloat(formData.peso));
      d.append('es_manual', esManual);
      if (cId) d.append('chofer_id', cId);
      if (pId) d.append('producto_id', pId);
      if (prId) d.append('productor_id', prId);
      if (tId) d.append('transporte_id', tId);
      if (formData.balancero) d.append('balancero', formData.balancero);
      if (formData.nro_remito) d.append('nro_remito', formData.nro_remito);
      if (archivoPDF) d.append('archivo', archivoPDF);
      d.append('es_contenedor', formData.es_contenedor);
      d.append('dispositivo_id', dispositivoId);

      // Pasar las fotos capturadas (array de objetos o strings)
      if (fotosCapturadas && fotosCapturadas.length > 0) {
        d.append('fotos', JSON.stringify(fotosCapturadas));
      } else if (camImages && camImages.length > 0) {
        // Fallback si por alguna razón no se capturaron ahora pero hay previas
        d.append('fotos', JSON.stringify(camImages));
      }

      const res = await fetch(`${API_BASE_URL}/api/pesadas`, {
        method: 'POST',
        headers: getAuthHeaders(null),
        body: d
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al registrar pesada');

      toast.success(`Pesada registrada: ${formData.vehiculo_patente} · ${Number(formData.peso).toLocaleString('es-AR')} kg`);
      if (onPesadaCreated) onPesadaCreated();
      setFormData(FORM_INICIAL);
      setPesadaActiva(null);
      capturedWeightRef.current = null;
      setArchivoPDF(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setErrorModal(getFriendlyError(e.message));
    } finally {
      setLoading(false);
    }
  };

  /* ─── Derivados para la vista ─── */
  const sentidoActual = pesadaActiva ? pesadaActiva.sentido : formData.sentido;
  const esSalida = sentidoActual === 'SALIDA';
  // Mismo criterio que el botón original: una operación nueva de INGRESO arranca con BRUTO, una de SALIDA con TARA
  const tipoARegistrar = pesadaActiva
    ? (pesadaActiva.tipo === 'BRUTO' ? 'TARA' : 'BRUTO')
    : (formData.sentido === 'SALIDA' ? 'TARA' : 'BRUTO');
  const tipoTexto = tipoARegistrar === 'BRUTO' ? 'Bruto (camión cargado)' : 'Tara (camión vacío)';
  const balanzaConectada = estadoBalanza.status === 'CONNECTED';
  const pesoNumero = parseFloat(formData.peso);
  const pesoCapturado = capturedWeightRef.current !== null && formData.peso.toString() === capturedWeightRef.current.toString();
  const puedeManual = canEnterManualWeight();
  const balanzaActual = balanzas.find(b => b.id === dispositivoId);

  const onEstado = useCallback((e) => setEstadoBalanza(e), []);

  const onDrop = (e) => {
    e.preventDefault();
    setArrastrando(false);
    elegirPDF(e.dataTransfer.files?.[0]);
  };

  return (
    <>
      <ErrorModal message={errorModal} onClose={() => setErrorModal(null)} />

      <PageHeader
        title="Nueva pesada"
        description={balanzaActual?.localidad_nombre
          ? `Balanza de ${balanzaActual.localidad_nombre}`
          : 'Registrá el bruto o la tara con la lectura de la balanza.'}
        actions={balanzas.length > 1 && (
          <label className="flex items-center gap-2 text-sm font-medium text-fg-muted">
            Balanza
            <Select
              value={dispositivoId ?? ''}
              onChange={(e) => {
                setDispositivoId(Number(e.target.value));
                setPesadaActiva(null);
                setFormData(prev => ({ ...prev, chofer_id: '', producto_id: '', productor_id: '', transporte_id: '' }));
              }}
              className="w-auto min-w-[200px]"
            >
              {balanzas.map(b => (
                <option key={b.id} value={b.id}>
                  {b.localidad_nombre}{b.connected ? '' : ' (sin conexión)'}
                </option>
              ))}
            </Select>
          </label>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        {/* ─── Columna izquierda: datos ─── */}
        <div className="space-y-6 min-w-0">
          {/* 1. Vehículo y operación */}
          <Card>
            <CardHeader icon={Truck} title="Vehículo y operación" description="La patente busca si el camión tiene una operación abierta." />
            <CardBody className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SearchableSelect
                  label="Patente"
                  required
                  name="vehiculo_patente"
                  value={formData.vehiculo_patente}
                  options={vehiculos}
                  displayKey="patente"
                  onChange={handleInputChange}
                  placeholder="Buscar o escribir patente"
                />

                {pesadaActiva ? (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-fg">Sentido</p>
                    <div className="h-10 flex items-center">
                      <Badge tone={esSalida ? 'salida' : 'ingreso'} icon={esSalida ? ArrowUp : ArrowDown}>
                        {esSalida ? 'Salida de mercadería' : 'Ingreso de mercadería'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-fg">Sentido <span className="text-danger" aria-hidden="true">*</span></legend>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'INGRESO', label: 'Ingreso', Icon: ArrowDown, on: 'border-ingreso bg-ingreso-soft text-ingreso' },
                        { value: 'SALIDA', label: 'Salida', Icon: ArrowUp, on: 'border-salida bg-salida-soft text-salida' },
                      ].map(({ value, label, Icon, on }) => {
                        const activo = formData.sentido === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => setFormData(prev => ({ ...prev, sentido: value }))}
                            className={cx(
                              'h-10 flex items-center justify-center gap-2 rounded-lg border-2 text-sm font-semibold transition-colors',
                              activo ? on : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                            )}
                          >
                            <Icon size={16} aria-hidden="true" />
                            {label}
                            {activo && <CheckCircle2 size={14} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              </div>

              {pesadaActiva ? (
                <Alert tone="warning" icon={Clock} title={`Operación abierta para ${formData.vehiculo_patente}`}>
                  Ya tiene registrado el <strong>{pesadaActiva.tipo === 'BRUTO' ? 'bruto' : 'tara'}</strong>. Esta pesada completa la operación con
                  la <strong>{tipoARegistrar === 'TARA' ? 'tara (camión vacío)' : 'bruto (camión cargado)'}</strong>. Los datos de la carga se completaron automáticamente.
                </Alert>
              ) : (
                <p className="text-sm text-fg-subtle">
                  Se registrará el <strong className="text-fg">{tipoTexto}</strong> y quedará abierta la operación hasta la segunda pesada.
                </p>
              )}
            </CardBody>
          </Card>

          {/* 2. Datos de la carga */}
          <Card>
            <CardHeader icon={ClipboardList} title="Datos de la carga" description="Chofer, transporte, productor y producto son obligatorios. Si escribís un nombre nuevo, se crea al registrar." />
            <CardBody className="grid gap-5 md:grid-cols-2">
              <SearchableSelect
                label="Chofer"
                required
                name="chofer_id"
                value={formData.chofer_id}
                options={choferesProp}
                displayKey="apellido_nombre"
                onChange={handleInputChange}
                placeholder="Apellido y nombre"
              />
              <SearchableSelect
                label="Transporte"
                required
                name="transporte_id"
                value={formData.transporte_id}
                options={transportesProp}
                displayKey="nombre"
                onChange={handleInputChange}
                placeholder="Empresa de transporte"
              />
              <SearchableSelect
                label="Productor"
                required
                name="productor_id"
                value={formData.productor_id}
                options={productoresProp}
                displayKey="nombre"
                onChange={handleInputChange}
                placeholder="Productor"
              />
              <SearchableSelect
                label="Producto"
                required
                name="producto_id"
                value={formData.producto_id}
                options={productosProp}
                displayKey="nombre"
                onChange={handleInputChange}
                placeholder="Tipo de carga"
              />
              <Field label="Nro. de remito" optional>
                <Input name="nro_remito" value={formData.nro_remito} onChange={handleInputChange} placeholder="0001-00000123" />
              </Field>
              <Field label="Balancero" optional>
                <Input name="balancero" value={formData.balancero} onChange={handleInputChange} placeholder="Nombre del balancero" />
              </Field>
              <label className="md:col-span-2 flex items-start gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="es_contenedor"
                  checked={formData.es_contenedor}
                  onChange={handleInputChange}
                  className="mt-0.5 h-4 w-4 accent-[var(--brand-solid)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-fg"><Package size={15} aria-hidden="true" /> Es contenedor</span>
                  <span className="block text-xs text-fg-subtle mt-0.5">Los datos del contenedor se completan después, desde el historial de pesadas.</span>
                </span>
              </label>
            </CardBody>
          </Card>

          {/* 3. Documentación */}
          <Card>
            <CardHeader icon={FileText} title="Carta de porte" description="PDF opcional. También se puede adjuntar después desde el historial." />
            <CardBody>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,application/pdf" className="sr-only" id="pdf-carta-porte" />
              {archivoPDF ? (
                <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-3">
                  <FileText size={20} className="text-success shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{archivoPDF.name}</p>
                    <p className="text-xs text-fg-subtle">{(archivoPDF.size / 1024).toFixed(0)} KB · se adjunta al registrar</p>
                  </div>
                  <Button size="sm" variant="ghost" icon={X} onClick={quitarPDF}>Quitar</Button>
                </div>
              ) : (
                <label
                  htmlFor="pdf-carta-porte"
                  onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={onDrop}
                  className={cx(
                    'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors',
                    arrastrando ? 'border-brand-solid bg-brand-soft' : 'border-line-strong hover:border-brand-solid hover:bg-surface-2'
                  )}
                >
                  <FileUp size={24} className="text-fg-subtle" aria-hidden="true" />
                  <span className="text-sm font-medium text-fg">Seleccioná o arrastrá el PDF</span>
                  <span className="text-xs text-fg-subtle">Solo archivos .pdf</span>
                </label>
              )}
            </CardBody>
          </Card>

          {/* 4. Cámaras */}
          <Card>
            <CardHeader
              icon={Camera}
              title="Cámaras"
              description={camBloqueado ? 'Módulo no incluido en el plan de esta localidad' : 'Se toma una foto por canal al registrar la pesada.'}
              tone={camBloqueado ? 'neutral' : 'brand'}
              actions={(
                <>
                  {camBloqueado && <Badge tone="neutral" icon={Lock}>Bloqueado</Badge>}
                  {!camBloqueado && camStatus === 'capturing' && <Badge tone="info" icon={Spinner}>Capturando</Badge>}
                  {!camBloqueado && camStatus === 'success' && <Badge tone="success" icon={CheckCircle2}>{camImages.length} foto{camImages.length !== 1 ? 's' : ''}</Badge>}
                  {!camBloqueado && camStatus === 'sin_camaras' && <Badge tone="warning" icon={AlertTriangle}>Sin cámaras</Badge>}
                  <Button
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => capturarFotos(formData.vehiculo_patente)}
                    disabled={camLoading || camBloqueado}
                    loading={camLoading}
                    title="Tomar fotos ahora para verificar las cámaras"
                  >
                    Probar captura
                  </Button>
                </>
              )}
            />
            <CardBody>
              {!camBloqueado && camStatus === 'sin_camaras' && (
                <Alert tone="warning" className="mb-4">
                  Las cámaras no respondieron. La pesada se puede registrar igual, sin fotos.
                </Alert>
              )}
              <div className="relative">
                {camBloqueado && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-surface/80 px-6 text-center backdrop-blur-sm">
                    <Lock size={24} className="text-fg-subtle" aria-hidden="true" />
                    <p className="text-sm font-semibold text-fg">Módulo de cámaras bloqueado</p>
                    <p className="text-sm text-fg-subtle">No está incluido en el plan de esta localidad. Consultá para habilitarlo.</p>
                  </div>
                )}
                <div className={cx('grid grid-cols-2 lg:grid-cols-3 gap-3', camBloqueado && 'pointer-events-none select-none')} aria-hidden={camBloqueado || undefined}>
                  {activeChannels.map(ch => {
                    const img = camImages.find(i => i.canal === ch);
                    const imgSrc = img ? (img.ruta.startsWith('/capturas/') ? img.ruta : `/capturas/${img.ruta}`) : null;
                    return (
                      <figure key={ch} className="relative aspect-video overflow-hidden rounded-lg border border-line bg-surface-2">
                        {img
                          ? <img src={imgSrc} alt={`Cámara ${ch}`} loading="lazy" className="h-full w-full object-cover" />
                          : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-fg-subtle">
                              <Monitor size={28} aria-hidden="true" />
                              <span className="text-xs">Sin captura</span>
                            </div>
                          )}
                        <figcaption className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          Cámara {ch}
                        </figcaption>
                        {camLoading && (
                          <div className="absolute inset-0 grid place-items-center bg-black/40">
                            <Spinner size={22} className="text-white" />
                          </div>
                        )}
                      </figure>
                    );
                  })}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ─── Columna derecha: balanza y confirmación ─── */}
        <aside className="space-y-6 xl:sticky xl:top-20" aria-label="Balanza y confirmación">
          <Card>
            <CardHeader icon={Scale} title="Balanza" description={balanzaActual?.localidad_nombre} />
            <CardBody className="space-y-5">
              <BalanzaDisplay
                key={dispositivoId ?? 'auto'}
                dispositivoId={dispositivoId}
                weightRef={currentWeightRef}
                statusRef={currentStatusRef}
                stableRef={currentStableRef}
                onEstado={onEstado}
              />

              <Button
                variant="primary"
                size="xl"
                icon={Hand}
                onClick={capturarPesoBalanza}
                disabled={!balanzaConectada}
                className="w-full justify-center"
              >
                {balanzaConectada ? 'Capturar peso de la balanza' : 'Balanza desconectada'}
              </Button>

              <Field
                label="Peso a registrar (kg)"
                hint={puedeManual
                  ? (pesoCapturado ? 'Tomado de la balanza.' : formData.peso ? 'Peso cargado a mano: se registra como manual.' : 'Capturalo de la balanza o escribilo a mano.')
                  : 'Solo se puede tomar de la balanza (sin permiso de carga manual).'}
              >
                {(a11y) => (
                  <div className="relative">
                    <input
                      {...a11y}
                      type="number"
                      inputMode="decimal"
                      name="peso"
                      value={formData.peso}
                      onChange={handleInputChange}
                      disabled={!puedeManual}
                      readOnly={!puedeManual}
                      placeholder="0"
                      className={cx(
                        'w-full h-16 rounded-lg border bg-surface px-4 pr-14 text-right font-mono text-3xl font-bold tabular text-fg placeholder:text-fg-subtle',
                        'focus:outline-none focus:border-brand-solid focus:ring-3 focus:ring-brand-solid/20',
                        pesoCapturado ? 'border-success' : 'border-line-strong',
                        !puedeManual && 'cursor-not-allowed bg-surface-2'
                      )}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-semibold text-fg-subtle">kg</span>
                    {!puedeManual && <Lock size={14} aria-hidden="true" className="absolute left-3 top-2 text-fg-subtle" />}
                  </div>
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={CheckCircle2} title="Confirmar operación" tone={esSalida ? 'warning' : 'brand'} />
            <CardBody className="space-y-4">
              <dl className="divide-y divide-line rounded-lg border border-line text-sm">
                {[
                  ['Patente', formData.vehiculo_patente
                    ? <span className="font-mono font-semibold">{formData.vehiculo_patente}</span>
                    : <span className="text-danger">Falta</span>],
                  ['Sentido', <Badge tone={esSalida ? 'salida' : 'ingreso'} icon={esSalida ? ArrowUp : ArrowDown}>{esSalida ? 'Salida' : 'Ingreso'}</Badge>],
                  ['Se registra', <span className="font-medium">{tipoARegistrar === 'BRUTO' ? 'Bruto' : 'Tara'}{pesadaActiva ? ' (cierra la operación)' : ''}</span>],
                  ['Peso', pesoNumero > 0
                    ? <span className="font-mono font-semibold tabular">{pesoNumero.toLocaleString('es-AR')} kg{!pesoCapturado && <span className="ml-1.5 font-sans text-xs font-normal text-warning">manual</span>}</span>
                    : <span className="text-danger">Falta</span>],
                  ['Carta de porte', archivoPDF ? 'Adjunta' : <span className="text-fg-subtle">Sin adjuntar</span>],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                    <dt className="text-fg-subtle">{k}</dt>
                    <dd className="text-right text-fg">{v}</dd>
                  </div>
                ))}
              </dl>

              <Button
                variant={esSalida ? 'salida' : 'primary'}
                size="xl"
                onClick={registrarPesada}
                loading={loading}
                className="w-full justify-center"
              >
                {loading
                  ? 'Registrando...'
                  : pesadaActiva
                    ? `Completar pesada — ${tipoARegistrar === 'TARA' ? 'Tara' : 'Bruto'}`
                    : `Registrar ${tipoARegistrar === 'TARA' ? 'tara' : 'bruto'}`}
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
