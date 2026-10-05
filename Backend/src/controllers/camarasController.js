import DigestFetch from "digest-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAPTURAS_DIR = path.join(__dirname, "../../capturas");
if (!fs.existsSync(CAPTURAS_DIR)) {
    fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
}

const slugLocalidad = (nombre) =>
    nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const getNombreLocalidad = async (localidadId) => {
    if (!localidadId) return 'global';
    const result = await pool.query('SELECT nombre FROM localidad WHERE id = $1', [localidadId]);
    return result.rows.length ? slugLocalidad(result.rows[0].nombre) : 'global';
};

const buildSnapshotUrl = (ip, marca, canal) => {
    if (marca === "hikvision") {
        return `http://${ip}/ISAPI/Streaming/channels/${canal}/picture`;
    }
    return `https://${ip}/cgi-bin/snapshot.cgi?channel=${canal}`;
};

const obtenerConfigGrabadora = async (localidadId = null) => {
    try {
        const result = await pool.query(`
            SELECT ip, usuario, contraseña AS password, marca
            FROM configuracion_dispositivos
            WHERE tipo_dispositivo = 'grabadora' AND activo = true
              AND ($1::int IS NULL OR localidad_id = $1)
            LIMIT 1
        `, [localidadId]);
        if (!result.rows || result.rows.length === 0) {
            throw new Error("No hay configuración de grabadora");
        }
        return result.rows[0];
    } catch (error) {
        console.error("Error al obtener configuración de la grabadora:", error);
        throw error;
    }
};

const crearClienteNVR = async (localidadId = null) => {
    const { ip, usuario, password, marca } = await obtenerConfigGrabadora(localidadId);
    const client = new DigestFetch(usuario, password);
    return { client, ip, marca };
};

// Cache de canales por localidad
const cacheCanalesPorLocalidad = {};
const CACHE_DURATION = 1000 * 60 * 1;

const detectarCanalesActivos = async (client, ip, marca, localidadId) => {
    const cacheKey = localidadId ?? 'global';
    const cached = cacheCanalesPorLocalidad[cacheKey];
    const ahora = Date.now();

    if (cached && (ahora - cached.ts < CACHE_DURATION)) {
        return cached.canales;
    }

    console.log("🔍 Detectando canales activos en NVR...");
    const maxCanales = 8;

    const probarCanal = async (ch) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
            const response = await client.fetch(
                buildSnapshotUrl(ip, marca, ch),
                { signal: controller.signal }
            );
            clearTimeout(timeout);
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                if (buffer.byteLength > 1000) return ch;
            }
        } catch (e) { /* ignorar */ }
        return null;
    };

    const resultados = await Promise.all(
        Array.from({ length: maxCanales }, (_, i) => probarCanal(i + 1))
    );

    const activos = resultados.filter(Boolean);
    cacheCanalesPorLocalidad[cacheKey] = { canales: activos, ts: ahora };
    console.log(`✅ Canales detectados: ${activos.join(", ") || "ninguno"}`);
    return activos;
};

export const getConfig = async (req, res) => {
    try {
        const localidadId = req.user?.localidad_id ?? null;
        const { client, ip, marca } = await crearClienteNVR(localidadId);
        const canales = await detectarCanalesActivos(client, ip, marca, localidadId);
        res.json({ success: true, canales });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

export const capturarTodo = async (req, res) => {
    const patente = (req.query.patente || "SIN_PATENTE").toUpperCase().trim();
    const localidadId = req.user?.localidad_id ?? null;
    console.log(`📸 Iniciando captura para Patente: ${patente}...`);

    let client, ip, marca;
    try {
        ({ client, ip, marca } = await crearClienteNVR(localidadId));
    } catch (error) {
        console.error("No se pudo conectar al NVR:", error.message);
        return res.json({ status: "sin_camaras", archivos: [], message: error.message });
    }

    let canales;
    try {
        canales = await detectarCanalesActivos(client, ip, marca, localidadId);
    } catch (error) {
        console.error("Error detectando canales:", error.message);
        return res.json({ status: "sin_camaras", archivos: [], message: error.message });
    }

    // Estructura: capturas/{localidad}/{patente}/
    const localidadNombre = await getNombreLocalidad(localidadId);
    const patenteDir = path.join(CAPTURAS_DIR, localidadNombre, patente);
    if (!fs.existsSync(patenteDir)) {
        fs.mkdirSync(patenteDir, { recursive: true });
    }

    const archivos = [];
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

    for (const ch of canales) {
        console.log(`🔍 Intentando capturar Canal ${ch} para ${patente}...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await client.fetch(
                buildSnapshotUrl(ip, marca, ch),
                { signal: controller.signal }
            );
            clearTimeout(timeout);

            if (!response.ok) throw new Error(`NVR respondió con status ${response.status}`);

            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length < 5000) throw new Error(`Imagen canal ${ch} dañada o vacía (${buffer.length} bytes)`);

            const fileName = `${patente}_cam${ch}_${timestamp}.jpg`;
            fs.writeFileSync(path.join(patenteDir, fileName), buffer);
            // ruta relativa a CAPTURAS_DIR para que el frontend la use como /capturas/{ruta}
            archivos.push({ canal: ch, ruta: `${localidadNombre}/${patente}/${fileName}` });
            console.log(`✅ Canal ${ch} capturado: ${fileName}`);
        } catch (error) {
            console.error(`❌ Error en Canal ${ch}:`, error.message);
        }
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
