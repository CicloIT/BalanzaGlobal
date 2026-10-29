import React, { useEffect, useState } from "react";
import { Save, Server, Cpu, KeyRound, Copy, Unplug, Camera, Lock, Unlock, Wifi, WifiOff, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useConfirm, useToast } from "../context/feedback";
import { API_BASE_URL, getAuthHeaders } from "../lib/api";
import { Card, CardHeader, CardBody } from "./ui/Card";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import Alert from "./ui/Alert";
import { Field, Input, Select } from "./ui/Field";
import { LoadingState } from "./ui/Spinner";

const CONFIG_VACIA = {
    balanza: { ip: "", puerto: "" },
    // canales: texto "1,2,5-8"; vacío = detección automática.
    // contraseña: solo la nueva que se escribe (el backend nunca devuelve la guardada)
    grabadora: { ip: "", puerto: "", usuario: "", contraseña: "", marca: "hikvision", canales: "" },
    grabadora_estado: { modo_captura: "directo", agente_online: false },
    // Módulos por plan de la localidad; los habilita solo el superadmin
    modulos: { camaras: false }
};

export default function DispositivosConfig() {
    const { isGlobal, isSuperadmin, user } = useAuth();
    const confirm = useConfirm();
    const toast = useToast();
    // Usuario global: elige qué localidad configura
    const [localidades, setLocalidades] = useState([]);
    const [localidadSel, setLocalidadSel] = useState(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(null);   // 'balanza' | 'grabadora' | 'modulo' mientras guarda
    const [config, setConfig] = useState(CONFIG_VACIA);
    // Token del agente recién generado: se muestra una sola vez
    const [tokenNuevo, setTokenNuevo] = useState(null);
    const [tokenBusy, setTokenBusy] = useState(false);
    // Resultado de "Probar cámaras": { ok, texto, conImagen? }
    const [pruebaCamaras, setPruebaCamaras] = useState(null);
    const [probando, setProbando] = useState(false);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            if (isGlobal && !localidadSel) return;
            const qs = isGlobal ? `?localidad_id=${localidadSel}` : "";
            const res = await fetch(`${API_BASE_URL}/api/config${qs}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();

            if (data.success) {
                const { grabadora, ...resto } = data.data;
                setConfig({
                    ...CONFIG_VACIA,
                    ...resto,
                    balanza: { ...CONFIG_VACIA.balanza, ...resto.balanza, puerto: resto.balanza?.puerto ?? "" },
                    grabadora: {
                        ...CONFIG_VACIA.grabadora,
                        ...grabadora,
                        contraseña: "",
                        puerto: grabadora?.puerto ?? "",
                        canales: grabadora?.canales?.join(",") ?? ""
                    }
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isGlobal) return;
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/config/balanzas`, { headers: getAuthHeaders() });
                const data = await res.json();
                if (data.success && data.data?.length) {
                    setLocalidades(data.data.map(b => ({ id: b.localidad_id, nombre: b.localidad_nombre })));
                    setLocalidadSel(data.data[0].localidad_id);
                }
            } catch (err) {
                console.error(err);
            }
        })();
    }, [isGlobal]);

    useEffect(() => {
        setTokenNuevo(null);
        setPruebaCamaras(null);
        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localidadSel]);

    const localidadId = config.balanza?.localidad_id ?? localidadSel ?? null;
    const localidadNombre = isGlobal
        ? localidades.find(l => l.id === localidadSel)?.nombre
        : user?.localidad_nombre;

    const llamarToken = async (method) => {
        const res = await fetch(`${API_BASE_URL}/api/config/balanza/token`, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify({ localidad_id: localidadId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.message || "Error en la petición");
        return data.data;
    };

    const handleGenerarToken = async () => {
        if (config.balanza.con_token && !(await confirm({
            title: "Regenerar token del agente",
            message: "Se genera un token nuevo. El agente que usa el token actual se desconecta hasta que se le cargue el nuevo.",
            confirmLabel: "Regenerar",
            tone: "danger",
        }))) return;
        try {
            setTokenBusy(true);
            const { token } = await llamarToken("POST");
            setTokenNuevo(token);
            toast.success("Token generado: copialo ahora, no se vuelve a mostrar");
            fetchConfig();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setTokenBusy(false);
        }
    };

    const handleModoDirecto = async () => {
        if (!(await confirm({
            title: "Pasar a modo directo",
            message: "La balanza pasa a lectura directa desde el servidor y se revoca el token del agente.",
            confirmLabel: "Pasar a modo directo",
            tone: "danger",
        }))) return;
        try {
            setTokenBusy(true);
            await llamarToken("DELETE");
            setTokenNuevo(null);
            toast.success("Balanza en modo directo; token revocado");
            fetchConfig();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setTokenBusy(false);
        }
    };

    // Archivo listo para Agente/sitios/<sitio>.json
    const jsonSitio = tokenNuevo && JSON.stringify({
        sitio: localidadNombre || "mi-sitio",
        central: `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/agent`,
        headers: {},
        balanzas: [{ nombre: "Balanza principal", token: tokenNuevo }]
    }, null, 2);

    const copiar = async (texto) => {
        try {
            await navigator.clipboard.writeText(texto);
            toast.success("Copiado al portapapeles");
        } catch {
            toast.error("No se pudo copiar; seleccioná el texto a mano");
        }
    };

    const handleSave = async (tipo) => {
        try {
            setSaving(tipo);

            const body = {
                ...config[tipo],
                puerto: config[tipo].puerto ? Number(config[tipo].puerto) : null,
                marca: config[tipo]?.marca || null,
                // Contraseña vacía = no cambiarla
                contraseña: config[tipo]?.contraseña || undefined,
                localidad_id: config[tipo]?.localidad_id ?? localidadSel ?? null
            };

            const res = await fetch(`${API_BASE_URL}/api/config/${tipo}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || "Error en la petición");
            }

            if (data.success) {
                toast.success(tipo === "balanza" ? "Balanza actualizada" : "Grabadora actualizada");
                fetchConfig();
            } else {
                throw new Error(data.message);
            }

        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(null);
        }
    };

    const handleModuloCamaras = async (habilitar) => {
        const idLocalidad = localidadId ?? user?.localidad_id;
        if (!habilitar && !(await confirm({
            title: "Deshabilitar módulo de cámaras",
            message: "La localidad deja de sacar fotos en las pesadas. La configuración de la grabadora se conserva.",
            confirmLabel: "Deshabilitar",
            tone: "danger",
        }))) return;
        try {
            setSaving("modulo");
            const res = await fetch(`${API_BASE_URL}/api/localidades/${idLocalidad}/modulos`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ camaras: habilitar })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || "No se pudo cambiar el módulo");
            toast.success(habilitar ? "Módulo de cámaras habilitado" : "Módulo de cámaras deshabilitado");
            setPruebaCamaras(null);
            fetchConfig();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(null);
        }
    };

    const handleProbarCamaras = async () => {
        try {
            setProbando(true);
            setPruebaCamaras(null);
            const qs = isGlobal ? `localidad_id=${localidadId}&` : "";
            await fetch(`${API_BASE_URL}/api/camaras/limpiar-cache?${qs}`, { method: "POST", headers: getAuthHeaders() });
            // Escanea 1..32 para mostrar qué canales tienen imagen y poder elegirlos
            const res = await fetch(`${API_BASE_URL}/api/camaras/config?${qs}escanear=32`, { headers: getAuthHeaders(null) });
            const data = await res.json().catch(() => ({}));
            if (!data.success) throw new Error(data.error || "No se pudo consultar la grabadora");
            const conImagen = data.con_imagen || [];
            const usados = data.configurados?.length
                ? `Fotos de: ${data.configurados.join(", ")} (configurados)`
                : `Fotos de: ${data.canales.join(", ") || "ninguno"} (automático, canales 1-16)`;
            setPruebaCamaras(conImagen.length
                ? { ok: true, conImagen, texto: `Canales con imagen: ${conImagen.join(", ")}. ${usados}` }
                : { ok: false, texto: `Ningún canal devolvió imagen: ${data.errores?.[0]?.error || "revisar usuario, contraseña y marca"}` });
        } catch (err) {
            setPruebaCamaras({ ok: false, texto: err.message });
        } finally {
            setProbando(false);
        }
    };

    const handleChange = (tipo, campo, valor) => {
        setConfig((prev) => ({
            ...prev,
            [tipo]: {
                ...prev[tipo],
                [campo]: valor
            }
        }));
    };

    const camarasOn = config.modulos.camaras;
    const esAgente = config.balanza.modo_conexion === "agente";
    const capturaPorAgente = config.grabadora_estado.modo_captura === "agente";

    return (
        <div className="space-y-6">
            {isGlobal && localidades.length > 0 && (
                <div className="flex flex-wrap items-end gap-3">
                    <Field label="Localidad a configurar" className="w-full sm:w-72">
                        <Select value={localidadSel ?? ""} onChange={(e) => setLocalidadSel(Number(e.target.value))}>
                            {localidades.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </Select>
                    </Field>
                    <p className="pb-2.5 text-sm text-fg-subtle">Cada localidad tiene su balanza y su grabadora.</p>
                </div>
            )}

            {loading ? (
                <LoadingState texto="Cargando configuración..." />
            ) : (
                <div className="grid gap-6 lg:grid-cols-2 items-start">
                    {/* ─── Balanza ─── */}
                    <Card>
                        <CardHeader
                            icon={Cpu}
                            title="Balanza"
                            description={localidadNombre ? `Conversor de ${localidadNombre}` : "Conversor RS232 → TCP"}
                        />
                        <CardBody className="space-y-5">
                            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                                <dt className="text-fg-subtle">Conexión</dt>
                                <dd>
                                    <Badge tone={esAgente ? "brand" : "neutral"}>
                                        {esAgente ? "Agente local del sitio" : "Directa desde el servidor"}
                                    </Badge>
                                </dd>
                                {esAgente && (
                                    <>
                                        <dt className="text-fg-subtle">Agente</dt>
                                        <dd className="flex flex-wrap items-center gap-2">
                                            <Badge tone={config.balanza.agente_online ? "success" : "danger"} icon={config.balanza.agente_online ? Wifi : WifiOff}>
                                                {config.balanza.agente_online ? "Conectado" : "Desconectado"}
                                            </Badge>
                                            {config.balanza.agente_info?.hostname && (
                                                <span className="text-xs text-fg-subtle">{config.balanza.agente_info.hostname}</span>
                                            )}
                                        </dd>
                                        <dt className="text-fg-subtle">Última conexión</dt>
                                        <dd className="text-fg tabular">
                                            {config.balanza.agente_ultima_conexion
                                                ? new Date(config.balanza.agente_ultima_conexion).toLocaleString("es-AR")
                                                : "Nunca"}
                                        </dd>
                                    </>
                                )}
                            </dl>

                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSave("balanza"); }}
                                className="space-y-4"
                            >
                                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                                    <Field label="Dirección IP" hint={esAgente ? "IP del conversor en la red del sitio (la usa el agente)." : undefined}>
                                        <Input value={config.balanza.ip ?? ""} onChange={(e) => handleChange("balanza", "ip", e.target.value)} placeholder="192.168.1.50" inputMode="decimal" className="font-mono" />
                                    </Field>
                                    <Field label="Puerto">
                                        <Input value={config.balanza.puerto} onChange={(e) => handleChange("balanza", "puerto", e.target.value)} placeholder="6000" inputMode="numeric" className="font-mono" />
                                    </Field>
                                </div>
                                <Button type="submit" variant="primary" icon={Save} loading={saving === "balanza"} disabled={Boolean(saving)}>
                                    Guardar balanza
                                </Button>
                            </form>

                            {/* Token del agente */}
                            {config.balanza.id && (
                                <div className="border-t border-line pt-5 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-medium text-fg">Token del agente</p>
                                        <Badge tone={config.balanza.con_token ? "success" : "neutral"}>
                                            {config.balanza.con_token ? "Generado" : "Sin token"}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="soft" icon={KeyRound} onClick={handleGenerarToken} loading={tokenBusy} disabled={tokenBusy}>
                                            {config.balanza.con_token ? "Regenerar token" : "Generar token"}
                                        </Button>
                                        {esAgente && (
                                            <Button size="sm" icon={Unplug} onClick={handleModoDirecto} disabled={tokenBusy}>
                                                Pasar a modo directo
                                            </Button>
                                        )}
                                    </div>

                                    {tokenNuevo && (
                                        <Alert tone="warning" title="Copiá el token ahora: no se vuelve a mostrar">
                                            <div className="mt-2 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <code className="flex-1 break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-fg border border-line">{tokenNuevo}</code>
                                                    <Button size="icon-sm" variant="ghost" icon={Copy} onClick={() => copiar(tokenNuevo)} aria-label="Copiar token" title="Copiar token" />
                                                </div>
                                                <div>
                                                    <p className="mb-1 text-xs font-medium text-fg">Archivo del agente (sitios/&lt;sitio&gt;.json)</p>
                                                    <div className="flex items-start gap-2">
                                                        <pre className="flex-1 relative overflow-x-auto rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-fg border border-line">{jsonSitio}</pre>
                                                        <Button size="icon-sm" variant="ghost" icon={Copy} onClick={() => copiar(jsonSitio)} aria-label="Copiar JSON" title="Copiar JSON" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Alert>
                                    )}
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {/* ─── Grabadora ─── */}
                    <Card>
                        <CardHeader
                            icon={Server}
                            title="Grabadora y cámaras"
                            description="NVR / DVR del sitio"
                            tone={camarasOn ? "brand" : "neutral"}
                            actions={!camarasOn && <Badge icon={Lock}>Bloqueado</Badge>}
                        />
                        <CardBody className="space-y-5">
                            {!camarasOn && (
                                <Alert tone="warning" icon={Lock} title="Módulo no incluido en el plan">
                                    Las cámaras no están habilitadas para esta localidad. Consultá para habilitarlo.
                                </Alert>
                            )}
                            {isSuperadmin && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3">
                                    <div className="text-sm">
                                        <p className="font-medium text-fg">Módulo de cámaras</p>
                                        <p className="text-xs text-fg-subtle">Solo superadmin · según el plan de la localidad</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={camarasOn ? "secondary" : "primary"}
                                        icon={camarasOn ? Lock : Unlock}
                                        onClick={() => handleModuloCamaras(!camarasOn)}
                                        loading={saving === "modulo"}
                                        disabled={Boolean(saving)}
                                    >
                                        {camarasOn ? "Deshabilitar" : "Habilitar"}
                                    </Button>
                                </div>
                            )}

                            <fieldset disabled={!camarasOn} className={camarasOn ? "space-y-5" : "space-y-5 opacity-60"}>
                                <legend className="sr-only">Datos de la grabadora</legend>
                                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                                    <dt className="text-fg-subtle">Capturas</dt>
                                    <dd className="flex flex-wrap items-center gap-2">
                                        <Badge tone={capturaPorAgente ? "brand" : "neutral"}>
                                            {capturaPorAgente ? "Vía agente local" : "Directo desde el servidor"}
                                        </Badge>
                                        {capturaPorAgente && (
                                            <Badge tone={config.grabadora_estado.agente_online ? "success" : "danger"} icon={config.grabadora_estado.agente_online ? Wifi : WifiOff}>
                                                Agente {config.grabadora_estado.agente_online ? "conectado" : "desconectado"}
                                            </Badge>
                                        )}
                                    </dd>
                                </dl>
                                <p className="-mt-2 text-xs text-fg-subtle">
                                    Sigue el modo de la balanza: el NVR tiene que estar en la misma red que el agente.
                                </p>

                                <form onSubmit={(e) => { e.preventDefault(); handleSave("grabadora"); }} className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                                        <Field label="Dirección IP" required>
                                            <Input value={config.grabadora.ip ?? ""} onChange={(e) => handleChange("grabadora", "ip", e.target.value)} placeholder="192.168.1.200" inputMode="decimal" className="font-mono" />
                                        </Field>
                                        <Field label="Puerto HTTP" hint="Vacío = 80">
                                            <Input value={config.grabadora.puerto} onChange={(e) => handleChange("grabadora", "puerto", e.target.value)} placeholder="80" inputMode="numeric" className="font-mono" />
                                        </Field>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Usuario">
                                            <Input value={config.grabadora.usuario ?? ""} onChange={(e) => handleChange("grabadora", "usuario", e.target.value)} autoComplete="off" />
                                        </Field>
                                        <Field label="Contraseña" hint={config.grabadora.con_password ? "Guardada. Escribí una nueva solo para cambiarla." : undefined}>
                                            <Input
                                                type="password"
                                                value={config.grabadora.contraseña}
                                                onChange={(e) => handleChange("grabadora", "contraseña", e.target.value)}
                                                placeholder={config.grabadora.con_password ? "•••••••• (sin cambios)" : ""}
                                                autoComplete="new-password"
                                            />
                                        </Field>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Marca">
                                            <Select value={config.grabadora.marca || "hikvision"} onChange={(e) => handleChange("grabadora", "marca", e.target.value)}>
                                                <option value="hikvision">Hikvision</option>
                                                <option value="dahua">Dahua</option>
                                            </Select>
                                        </Field>
                                        <Field label="Canales para fotos" hint="Ej: 1,2,5-8. Vacío: los que respondan del 1 al 16.">
                                            <Input value={config.grabadora.canales} onChange={(e) => handleChange("grabadora", "canales", e.target.value)} placeholder="Automático" className="font-mono" />
                                        </Field>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="submit" variant="primary" icon={Save} loading={saving === "grabadora"} disabled={Boolean(saving)}>
                                            Guardar grabadora
                                        </Button>
                                        {config.grabadora.id && (
                                            <Button icon={Camera} onClick={handleProbarCamaras} loading={probando} disabled={probando}>
                                                {probando ? "Probando (puede tardar)..." : "Probar cámaras"}
                                            </Button>
                                        )}
                                    </div>
                                </form>

                                {pruebaCamaras && (
                                    <Alert tone={pruebaCamaras.ok ? "success" : "danger"} icon={pruebaCamaras.ok ? CheckCircle2 : AlertTriangle} onClose={() => setPruebaCamaras(null)}>
                                        <p className="text-fg">{pruebaCamaras.texto}</p>
                                        {pruebaCamaras.conImagen?.length > 0 && (
                                            <Button
                                                size="sm"
                                                variant="soft"
                                                className="mt-2"
                                                onClick={() => handleChange("grabadora", "canales", pruebaCamaras.conImagen.join(","))}
                                            >
                                                Usar estos canales (después Guardar)
                                            </Button>
                                        )}
                                    </Alert>
                                )}
                            </fieldset>
                        </CardBody>
                    </Card>
                </div>
            )}

            {!isGlobal && localidadNombre && (
                <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                    <MapPin size={13} aria-hidden="true" /> Configuración de {localidadNombre}
                </p>
            )}
        </div>
    );
}
