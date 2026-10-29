import DigestFetch from "digest-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scopeSql, userForRead, slugLocalidadPorId } from "../utils/scope.js";
import pool from "../config/database.js";
import { modoBalanzaDeLocalidad, getAgenteDeLocalidad } from "../services/balanzaService.js";
import { pedirSnapshotsAgente } from "../services/agenteGateway.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAPTURAS_DIR = path.join(__dirname, "../../capturas");
if (!fs.existsSync(CAPTURAS_DIR)) {
    fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
}

const CANALES_AUTO = 16;      // sin canales configurados: se buscan 1..16
export const CANAL_MAX = 64;  // "Probar cámaras" y la config aceptan hasta este canal
const ESCANEO_MAX = 32;
const CONCURRENCIA = 8;       // pedidos simultáneos al NVR
// Un NVR Dahua por VPN tarda varios segundos por snapshot cuando se le piden 8 a la vez
const DETECCION = { timeoutMs: 8000, minBytes: 1000 };
const CAPTURA = { timeoutMs: 15000, minBytes: 5000 };

const buildSnapshotUrl = ({ ip, puerto, marca }, canal) => {
    const host = puerto ? `${ip}:${puerto}` : ip;
    if (marca === "hikvision") {
        // ISAPI numera canal*100 + stream: 101 = cámara 1, stream principal
        return `http://${host}/ISAPI/Streaming/channels/${canal * 100 + 1}/picture`;
    }
    // Dahua por http: evita depender del certificado autofirmado del NVR
    return `http://${host}/cgi-bin/snapshot.cgi?channel=${canal}`;
};

// `user` es el usuario efectivo (userForRead): restringe la grabadora a su empresa/localidad
const obtenerConfigGrabadora = async (user) => {
    const scope = scopeSql('localidad_id', user, 1);
    const result = await pool.query(`
        SELECT ip, puerto, usuario, contraseña AS password, marca, localidad_id, canales
        FROM configuracion_dispositivos
        WHERE tipo_dispositivo = 'grabadora' AND activo = true
          AND ${scope.sql}
        ORDER BY localidad_id
        LIMIT 1
    `, scope.params);
    const nvr = result.rows[0];
    if (!nvr) throw new Error("No hay configuración de grabadora");
    if (!nvr.ip) throw new Error("La grabadora no tiene IP configurada");
    return nvr;
};

// El NVR está en la LAN de la localidad: si su balanza va por agente, las fotos también
const modoCaptura = (localidadId) => modoBalanzaDeLocalidad(localidadId) === 'agente' ? 'agente' : 'directo';

// Como Promise.all(items.map(fn)) pero con a lo sumo `limite` en curso
const mapConLimite = async (items, limite, fn) => {
    const resultados = new Array(items.length);
    let siguiente = 0;
    const trabajador = async () => {
        while (siguiente < items.length) {
            const i = siguiente++;
            resultados[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
    return resultados;
};

const snapshotsDirecto = async (nvr, canales, { timeoutMs, minBytes }) => {
    const client = new DigestFetch(nvr.usuario, nvr.password);
    return mapConLimite(canales, CONCURRENCIA, async (canal) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await client.fetch(buildSnapshotUrl(nvr, canal), { signal: controller.signal });
            if (!response.ok) return { canal, error: `NVR respondió ${response.status}` };
            return { canal, buffer: Buffer.from(await response.arrayBuffer()) };
        } catch (e) {
            return { canal, error: e.name === 'AbortError' ? 'timeout' : e.message };
        } finally {
            clearTimeout(timeout);
        }
    }).then(resultados => resultados.map(r =>
        r.buffer && r.buffer.length < minBytes
            ? { canal: r.canal, error: `imagen muy chica (${r.buffer.length} bytes)` }
            : r
    ));
};

// [{ canal, buffer }] | [{ canal, error }] — vía agente del sitio o directo desde el central
const obtenerSnapshots = async (nvr, canales, opciones) => {
    if (modoCaptura(nvr.localidad_id) === 'agente') {
        const ws = getAgenteDeLocalidad(nvr.localidad_id);
        if (!ws) throw new Error("Agente del sitio desconectado: no se pueden pedir las fotos al NVR");
        return pedirSnapshotsAgente(ws, nvr, canales, opciones);
    }
    return snapshotsDirecto(nvr, canales, opciones);
};

// Cache de canales por localidad
const cacheCanalesPorLocalidad = {};
const CACHE_DURATION = 1000 * 60 * 1;

export const invalidarCacheCanales = (localidadId) => {
    delete cacheCanalesPorLocalidad[localidadId ?? 'global'];
};

const rango = (n) => Array.from({ length: n }, (_, i) => i + 1);

// Canales configurados en la grabadora → esos, sin preguntar al NVR.
// Sin configurar → los que devuelven imagen entre 1 y CANALES_AUTO (con caché).
const detectarCanalesActivos = async (nvr) => {
    if (nvr.canales?.length) return nvr.canales;
    const cacheKey = nvr.localidad_id ?? 'global';
    const cached = cacheCanalesPorLocalidad[cacheKey];
    const ahora = Date.now();

    if (cached && (ahora - cached.ts < CACHE_DURATION)) {
        return cached.canales;
    }

    console.log(`🔍 Detectando canales activos en NVR (localidad ${cacheKey}, ${modoCaptura(nvr.localidad_id)})...`);
    const resultados = await obtenerSnapshots(nvr, rango(CANALES_AUTO), DETECCION);
    resultados.filter(r => r.error).forEach(r => console.warn(`⚠️ Canal ${r.canal}: ${r.error}`));

    const activos = resultados.filter(r => r.buffer).map(r => r.canal);
    cacheCanalesPorLocalidad[cacheKey] = { canales: activos, ts: ahora };
    console.log(`✅ Canales detectados: ${activos.join(", ") || "ninguno"}`);
    return activos;
};

// GET /api/camaras/config — canales que se usan para las fotos.
// ?escanear=N → además prueba los canales 1..N (máx. ESCANEO_MAX) para ver cuáles tienen imagen.
export const getConfig = async (req, res) => {
    try {
        const nvr = await obtenerConfigGrabadora(userForRead(req));
        const escanear = Math.min(parseInt(req.query.escanear, 10) || 0, ESCANEO_MAX);
        const respuesta = {
            success: true,
            modo: modoCaptura(nvr.localidad_id),
            configurados: nvr.canales ?? null,
            canales: await detectarCanalesActivos(nvr),
        };
        if (escanear > 0) {
            const resultados = await obtenerSnapshots(nvr, rango(escanear), DETECCION);
            respuesta.con_imagen = resultados.filter(r => r.buffer).map(r => r.canal);
            respuesta.errores = resultados.filter(r => r.error).map(({ canal, error }) => ({ canal, error }));
        }
        res.json(respuesta);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const capturarTodo = async (req, res) => {
    // La patente arma la carpeta: solo letras/números/guion para no salir de CAPTURAS_DIR
    const patente = String(req.query.patente || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "") || "SIN_PATENTE";
    const usuario = userForRead(req);
    console.log(`📸 Iniciando captura para patente: ${patente}...`);

    let nvr, canales, resultados;
    try {
        nvr = await obtenerConfigGrabadora(usuario);
        canales = await detectarCanalesActivos(nvr);
        if (!canales.length) {
            return res.json({ status: "sin_camaras", archivos: [], message: "El NVR no tiene canales activos." });
        }
        resultados = await obtenerSnapshots(nvr, canales, CAPTURA);
    } catch (error) {
        console.error("No se pudo capturar del NVR:", error.message);
        return res.json({ status: "sin_camaras", archivos: [], message: error.message });
    }

    // Estructura: capturas/{localidad}/{patente}/
    const localidadNombre = (await slugLocalidadPorId(nvr.localidad_id)) ?? 'global';
    const patenteDir = path.join(CAPTURAS_DIR, localidadNombre, patente);
    if (!fs.existsSync(patenteDir)) {
        fs.mkdirSync(patenteDir, { recursive: true });
    }

    const archivos = [];
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

    for (const { canal, buffer, error } of resultados) {
        if (error) {
            console.error(`❌ Error en Canal ${canal}:`, error);
            continue;
        }
        const fileName = `${patente}_cam${canal}_${timestamp}.jpg`;
        fs.writeFileSync(path.join(patenteDir, fileName), buffer);
        // ruta relativa a CAPTURAS_DIR para que el frontend la use como /capturas/{ruta}
        archivos.push({ canal, ruta: `${localidadNombre}/${patente}/${fileName}` });
        console.log(`✅ Canal ${canal} capturado: ${fileName}`);
    }

    if (archivos.length === 0) {
        return res.json({ status: "sin_camaras", archivos: [], message: "No se pudo capturar ninguna imagen." });
    }

    res.json({ status: "ok", archivos });
};

export const limpiarCache = (req, res) => {
    Object.keys(cacheCanalesPorLocalidad).forEach(k => delete cacheCanalesPorLocalidad[k]);
    res.json({ success: true, message: "Cache limpiado" });
};
