import crypto from 'crypto';

// Snapshots del NVR de la LAN del sitio (Hikvision / Dahua por http), con autenticación
// Digest (MD5, qop=auth) o Basic según lo que pida el equipo. Sin dependencias externas.

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

export const buildSnapshotUrl = ({ ip, puerto, marca }, canal) => {
    const host = puerto ? `${ip}:${puerto}` : ip;
    // ISAPI numera canal*100 + stream: 101 = cámara 1, stream principal
    if (marca === 'hikvision') return `http://${host}/ISAPI/Streaming/channels/${canal * 100 + 1}/picture`;
    return `http://${host}/cgi-bin/snapshot.cgi?channel=${canal}`;
};

const parseChallenge = (header) => {
    const params = {};
    for (const [, k, v1, v2] of header.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) params[k.toLowerCase()] = v1 ?? v2;
    return params;
};

const authDigest = ({ usuario, password }, challenge, method, url) => {
    const { realm, nonce, qop, opaque, algorithm } = parseChallenge(challenge);
    const { pathname, search } = new URL(url);
    const uri = pathname + search;
    const ha1 = md5(`${usuario}:${realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    const usaQop = qop?.split(',').map(s => s.trim()).includes('auth');
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    const response = usaQop ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`);
    return [
        `Digest username="${usuario}"`, `realm="${realm}"`, `nonce="${nonce}"`, `uri="${uri}"`,
        `response="${response}"`,
        ...(algorithm ? [`algorithm=${algorithm}`] : []),
        ...(opaque ? [`opaque="${opaque}"`] : []),
        ...(usaQop ? ['qop=auth', `nc=${nc}`, `cnonce="${cnonce}"`] : []),
    ].join(', ');
};

// Devuelve el JPG del canal como Buffer; lanza Error con mensaje legible si falla
export const snapshot = async (nvr, canal, timeoutMs = 15000) => {
    const url = buildSnapshotUrl(nvr, canal);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let res = await fetch(url, { signal: controller.signal });
        if (res.status === 401) {
            const challenge = res.headers.get('www-authenticate') || '';
            await res.arrayBuffer().catch(() => {});
            const authorization = /^digest/i.test(challenge)
                ? authDigest(nvr, challenge, 'GET', url)
                : `Basic ${Buffer.from(`${nvr.usuario}:${nvr.password}`).toString('base64')}`;
            res = await fetch(url, { headers: { Authorization: authorization }, signal: controller.signal });
        }
        if (res.status === 401) throw new Error('NVR rechazó usuario/contraseña (401)');
        if (!res.ok) throw new Error(`NVR respondió ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('timeout');
        throw new Error(err.cause?.code || err.message);
    } finally {
        clearTimeout(timer);
    }
};

const CONCURRENCIA = 8;   // pedidos simultáneos al NVR (el central calcula su timeout con esto)

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

// Pide varios canales (de a CONCURRENCIA) → [{ canal, ok, jpg (base64), bytes } | { canal, ok:false, error }]
export const snapshots = async (nvr, canales, { timeoutMs, minBytes = 0 } = {}) =>
    mapConLimite(canales, CONCURRENCIA, async (canal) => {
        try {
            const buffer = await snapshot(nvr, canal, timeoutMs);
            if (buffer.length < minBytes) return { canal, ok: false, bytes: buffer.length, error: `imagen muy chica (${buffer.length} bytes)` };
            return { canal, ok: true, bytes: buffer.length, jpg: buffer.toString('base64') };
        } catch (err) {
            return { canal, ok: false, error: err.message };
        }
    });
