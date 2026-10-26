import React, { useEffect, useState } from "react";
import { Save, RefreshCw, Server, Cpu, CheckCircle2, AlertCircle, KeyRound, Copy, Unplug } from "lucide-react";
import { useThemeContext } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = "";
const STORAGE_KEY = "balanza_user";

const CONFIG_VACIA = {
    balanza: { ip: "", puerto: "" },
    grabadora: { ip: "", usuario: "", contraseña: "", marca: "hikvision" }
};

const getAuthHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const user = JSON.parse(stored);
            if (user?.id) headers["x-user-id"] = user.id.toString();
            if (user?.username) headers["x-username"] = user.username;
        }
    } catch { }
    return headers;
};

export default function DispositivosConfig() {
    const { isDark } = useThemeContext();
    const { isGlobal, user } = useAuth();
    // Usuario global: elige qué localidad configura
    const [localidades, setLocalidades] = useState([]);
    const [localidadSel, setLocalidadSel] = useState(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(CONFIG_VACIA);
    // Token del agente recién generado: se muestra una sola vez
    const [tokenNuevo, setTokenNuevo] = useState(null);
    const [tokenBusy, setTokenBusy] = useState(false);

    const [msg, setMsg] = useState(null);
    const [msgType, setMsgType] = useState("success");

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
                setConfig({ ...CONFIG_VACIA, ...data.data });
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
        fetchConfig();
    }, [localidadSel]);

    const localidadId = config.balanza?.localidad_id ?? localidadSel ?? null;
    const localidadNombre = isGlobal
        ? localidades.find(l => l.id === localidadSel)?.nombre
        : user?.localidad_nombre;

    const mostrarMensaje = (tipo, texto) => {
        setMsgType(tipo);
        setMsg(texto);
        if (tipo === "success") setTimeout(() => setMsg(null), 3000);
    };

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
        if (config.balanza.con_token && !window.confirm(
            "Se va a generar un token nuevo. El agente que usa el token actual se desconecta hasta que se le cargue el nuevo. ¿Continuar?"
        )) return;
        try {
            setTokenBusy(true);
            setMsg(null);
            const { token } = await llamarToken("POST");
            setTokenNuevo(token);
            mostrarMensaje("success", "✓ Token generado: copialo ahora, no se vuelve a mostrar");
            fetchConfig();
        } catch (err) {
            mostrarMensaje("error", err.message);
        } finally {
            setTokenBusy(false);
        }
    };

    const handleModoDirecto = async () => {
        if (!window.confirm(
            "La balanza pasa a lectura directa desde el servidor y se revoca el token del agente. ¿Continuar?"
        )) return;
        try {
            setTokenBusy(true);
            setMsg(null);
            await llamarToken("DELETE");
            setTokenNuevo(null);
            mostrarMensaje("success", "✓ Balanza en modo directo; token revocado");
            fetchConfig();
        } catch (err) {
            mostrarMensaje("error", err.message);
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
            mostrarMensaje("success", "✓ Copiado al portapapeles");
        } catch {
            mostrarMensaje("error", "No se pudo copiar; seleccioná el texto a mano");
        }
    };

    const handleSave = async (tipo) => {
        try {
            setSaving(true);
            setMsg(null);

            const body = {
                ...config[tipo],
                puerto: config[tipo].puerto ? Number(config[tipo].puerto) : null,
                marca: config[tipo]?.marca || null,
                localidad_id: config[tipo]?.localidad_id ?? localidadSel ?? null
            };

            const res = await fetch(`/api/config/${tipo}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.message || "Error en la petición");
            }

            if (data.success) {
                setMsgType("success");
                setMsg(`✓ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} actualizada`);
                fetchConfig();
                setTimeout(() => setMsg(null), 3000);
            } else {
                throw new Error(data.message);
            }

        } catch (err) {
            setMsgType("error");
            setMsg(err.message);
        } finally {
            setSaving(false);
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

    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
        
        * {
            font-family: 'Outfit', sans-serif;
        }

        @keyframes slideInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes pulse-glow {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7);
            }
            50% {
                box-shadow: 0 0 0 10px rgba(99, 102, 241, 0);
            }
        }

        @keyframes shimmer {
            0% {
                background-position: -1000px 0;
            }
            100% {
                background-position: 1000px 0;
            }
        }

        .device-card {
            animation: slideInUp 0.6s ease-out;
        }

        .device-card:nth-child(2) {
            animation-delay: 0.1s;
        }

        .device-card:nth-child(3) {
            animation-delay: 0.2s;
        }

        .input-field {
            position: relative;
            overflow: hidden;
        }

        .input-field input:focus {
            animation: none;
        }

        .save-button:hover:not(:disabled) {
            transform: translateY(-2px);
        }

        .icon-pulse {
            animation: pulse-glow 2s infinite;
        }

        .loading-spinner {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <style>{styles}</style>
                <div className="text-center">
                    <div className="mb-4">
                        <RefreshCw size={48} className="loading-spinner mx-auto text-indigo-500" />
                    </div>
                    <p className={`text-lg font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        Cargando configuración...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-indigo-50'} transition-colors duration-300`}>
            <style>{styles}</style>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* HEADER SECTION */}
                <div className="mb-12">
                    <div className="inline-block mb-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                            <div className="text-indigo-500 font-black">⚙</div>
                        </div>
                    </div>
                    <h1 className={`text-4xl md:text-5xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Configuración de Dispositivos
                    </h1>
                    <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        Gestiona la conexión de tu balanza y cámara de seguridad
                    </p>
                </div>

                {/* ALERT MESSAGE */}
                {msg && (
                    <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${msgType === "success"
                        ? isDark
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : isDark
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                            : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        {msgType === "success" ? (
                            <CheckCircle2 size={20} className="flex-shrink-0" />
                        ) : (
                            <AlertCircle size={20} className="flex-shrink-0" />
                        )}
                        <span className="font-semibold">{msg}</span>
                    </div>
                )}

                {isGlobal && localidades.length > 0 && (
                    <label className={`mb-6 flex items-center gap-3 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Localidad
                        <select
                            value={localidadSel ?? ""}
                            onChange={(e) => setLocalidadSel(Number(e.target.value))}
                            className={`px-4 py-2 rounded-xl border font-medium ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                        >
                            {localidades.map(l => (
                                <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                        </select>
                    </label>
                )}

                {/* DEVICE CARDS GRID */}
                <div className="grid md:grid-cols-2 gap-8 lg:gap-6">
                    {/* BALANZA CARD */}
                    <div className={`device-card group rounded-3xl border-2 transition-all duration-300 p-8 ${isDark
                        ? 'bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/80'
                        : 'bg-white border-slate-200/50 hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-xl'
                        }`}>
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl transition-all duration-300 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'
                                    } group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-indigo-500/20`}>
                                    <Cpu size={28} className="text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        Balanza
                                    </h3>
                                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Dispositivo de pesaje
                                    </p>
                                </div>
                            </div>
                            <div className={`h-3 w-3 rounded-full ${isDark ? 'bg-emerald-500/50' : 'bg-emerald-400'}`} />
                        </div>

                        <div className={`mb-4 text-sm font-semibold space-y-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            <p>
                                Modo:{" "}
                                <span className={config.balanza.modo_conexion === "agente" ? "text-indigo-500" : ""}>
                                    {config.balanza.modo_conexion === "agente" ? "agente local del sitio" : "directo desde el servidor"}
                                </span>
                            </p>
                            {config.balanza.modo_conexion === "agente" && (
                                <>
                                    <p>
                                        Agente:{" "}
                                        <span className={config.balanza.agente_online ? "text-emerald-500" : "text-red-500"}>
                                            {config.balanza.agente_online ? "conectado" : "desconectado"}
                                        </span>
                                        {" · "}última conexión:{" "}
                                        {config.balanza.agente_ultima_conexion
                                            ? new Date(config.balanza.agente_ultima_conexion).toLocaleString()
                                            : "nunca"}
                                        {config.balanza.agente_info?.hostname && ` (${config.balanza.agente_info.hostname})`}
                                    </p>
                                    <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        IP y puerto del conversor en la red del sitio: los usa el agente local.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="input-field">
                                <input
                                    placeholder="Dirección IP"
                                    value={config.balanza.ip}
                                    onChange={(e) => handleChange("balanza", "ip", e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${isDark
                                        ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100'
                                        }`}
                                />
                            </div>
                            <div className="input-field">
                                <input
                                    placeholder="Puerto"
                                    value={config.balanza.puerto}
                                    onChange={(e) => handleChange("balanza", "puerto", e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${isDark
                                        ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100'
                                        }`}
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => handleSave("balanza")}
                            disabled={saving}
                            className={`save-button w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-all duration-200 ${saving
                                ? isDark
                                    ? 'bg-indigo-600/50 text-indigo-200 cursor-not-allowed'
                                    : 'bg-indigo-300 text-indigo-50 cursor-not-allowed'
                                : isDark
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-600/30'
                                }`}
                        >
                            {saving ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Guardar
                                </>
                            )}
                        </button>

                        {/* TOKEN DEL AGENTE */}
                        {config.balanza.id && (
                            <div className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <p className={`mb-3 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                    Token del agente: {config.balanza.con_token ? "generado" : "sin token"}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={handleGenerarToken}
                                        disabled={tokenBusy}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border transition-all disabled:opacity-50 ${isDark
                                            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                                            : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                            }`}
                                    >
                                        <KeyRound size={16} />
                                        {config.balanza.con_token ? "Regenerar token" : "Generar token"}
                                    </button>
                                    {config.balanza.modo_conexion === "agente" && (
                                        <button
                                            onClick={handleModoDirecto}
                                            disabled={tokenBusy}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border transition-all disabled:opacity-50 ${isDark
                                                ? 'border-slate-600 text-slate-300 hover:bg-slate-700/50'
                                                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                                }`}
                                        >
                                            <Unplug size={16} />
                                            Pasar a modo directo
                                        </button>
                                    )}
                                </div>

                                {tokenNuevo && (
                                    <div className={`mt-4 p-4 rounded-xl border text-sm ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                                        <p className="font-bold mb-2">Copiá el token ahora: no se vuelve a mostrar.</p>
                                        <div className="flex items-center gap-2 mb-3">
                                            <code className="flex-1 break-all font-mono text-xs">{tokenNuevo}</code>
                                            <button onClick={() => copiar(tokenNuevo)} title="Copiar token" className="p-2 rounded-lg hover:bg-black/10">
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                        <p className="font-semibold mb-1">Archivo del agente (sitios/&lt;sitio&gt;.json):</p>
                                        <div className="flex items-start gap-2">
                                            <pre className="flex-1 overflow-x-auto font-mono text-xs whitespace-pre">{jsonSitio}</pre>
                                            <button onClick={() => copiar(jsonSitio)} title="Copiar JSON" className="p-2 rounded-lg hover:bg-black/10">
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* GRABADORA CARD */}
                    <div className={`device-card group rounded-3xl border-2 transition-all duration-300 p-8 ${isDark
                        ? 'bg-slate-800/50 border-slate-700/50 hover:border-purple-500/50 hover:bg-slate-800/80'
                        : 'bg-white border-slate-200/50 hover:border-purple-300 hover:bg-purple-50/30 hover:shadow-xl'
                        }`}>
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-2xl transition-all duration-300 ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'
                                    } group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-purple-500/20`}>
                                    <Server size={28} className="text-purple-500" />
                                </div>
                                <div>
                                    <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        Grabadora
                                    </h3>
                                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Sistema NVR / DVR
                                    </p>
                                </div>
                            </div>
                            <div className={`h-3 w-3 rounded-full ${isDark ? 'bg-amber-500/50' : 'bg-amber-400'}`} />
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="input-field">
                                <input
                                    placeholder="Dirección IP"
                                    value={config.grabadora.ip}
                                    onChange={(e) => handleChange("grabadora", "ip", e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${isDark
                                        ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100'
                                        }`}
                                />
                            </div>
                            <div className="input-field">
                                <input
                                    placeholder="Usuario"
                                    value={config.grabadora.usuario}
                                    onChange={(e) => handleChange("grabadora", "usuario", e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${isDark
                                        ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100'
                                        }`}
                                />
                            </div>
                            <div className="input-field">
                                <input
                                    placeholder="Contraseña"
                                    type="password"
                                    value={config.grabadora.contraseña}
                                    onChange={(e) => handleChange("grabadora", "contraseña", e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${isDark
                                        ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100'
                                        }`}
                                />
                            </div>
                            <div className="input-field">
                                <select
                                    value={config.grabadora.marca || "hikvision"}
                                    onChange={(e) => handleChange("grabadora", "marca", e.target.value)}
                                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${isDark
                                        ? 'bg-slate-700/50 border-slate-600 text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100'
                                        }`}
                                >
                                    <option value="hikvision">Hikvision</option>
                                    <option value="dahua">Dahua</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={() => handleSave("grabadora")}
                            disabled={saving}
                            className={`save-button w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-all duration-200 ${saving
                                ? isDark
                                    ? 'bg-purple-600/50 text-purple-200 cursor-not-allowed'
                                    : 'bg-purple-300 text-purple-50 cursor-not-allowed'
                                : isDark
                                    ? 'bg-purple-600 text-white hover:bg-purple-500 active:scale-95'
                                    : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-lg shadow-purple-600/30'
                                }`}
                        >
                            {saving ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Guardar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}