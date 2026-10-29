// Simula un NVR por http con autenticación Digest (MD5, qop=auth), para probar capturas sin hardware.
// Uso: node scripts/sim_nvr.mjs [puerto=8090] [canales=4] [usuario=admin] [password=admin]
// Responde las rutas de Dahua (/cgi-bin/snapshot.cgi?channel=N) y Hikvision
// (/ISAPI/Streaming/channels/N01/picture) con un JPG válido de ~8 KB; canales > `canales` → 404.
import http from 'http';
import crypto from 'crypto';

const [puerto = 8090, canales = 4, usuario = 'admin', password = 'admin'] = process.argv.slice(2);
const REALM = 'sim-nvr';
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const nonces = new Set();

// JPG mínimo válido (1×1 gris) + comentario de relleno para superar el mínimo de bytes del backend
const JPG_BASE = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP////////////////////////////////////////////////////////////////////////////////////' +
    '//////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const jpgCanal = (canal) => {
    const texto = Buffer.from(`sim-nvr canal ${canal} ${new Date().toISOString()} `.repeat(200).slice(0, 8000));
    const com = Buffer.concat([Buffer.from([0xff, 0xfe, (texto.length + 2) >> 8, (texto.length + 2) & 0xff]), texto]);
    return Buffer.concat([JPG_BASE.subarray(0, 2), com, JPG_BASE.subarray(2)]);
};

const parseAuth = (header) => {
    const params = {};
    for (const [, k, v1, v2] of header.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) params[k] = v1 ?? v2;
    return params;
};

const autorizado = (req) => {
    const header = req.headers.authorization || '';
    if (!/^Digest /i.test(header)) return false;
    const a = parseAuth(header);
    if (a.username !== usuario || !nonces.has(a.nonce)) return false;
    const ha1 = md5(`${usuario}:${REALM}:${password}`);
    const ha2 = md5(`${req.method}:${a.uri}`);
    const esperado = a.qop
        ? md5(`${ha1}:${a.nonce}:${a.nc}:${a.cnonce}:${a.qop}:${ha2}`)
        : md5(`${ha1}:${a.nonce}:${ha2}`);
    return a.response === esperado;
};

http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const hik = url.pathname.match(/channels\/(\d+)\/picture/)?.[1];
    const canal = Number(url.searchParams.get('channel') ?? (hik && Math.floor(Number(hik) / 100)));
    if (!autorizado(req)) {
        const nonce = crypto.randomBytes(16).toString('hex');
        nonces.add(nonce);
        res.writeHead(401, { 'WWW-Authenticate': `Digest realm="${REALM}", qop="auth", nonce="${nonce}", opaque="sim"` });
        return res.end();
    }
    if (!Number.isInteger(canal) || canal < 1 || canal > Number(canales)) {
        res.writeHead(404);
        return res.end();
    }
    console.log(`📸 canal ${canal} → ${req.socket.remoteAddress}`);
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(jpgCanal(canal));
}).listen(Number(puerto), () => console.log(`NVR simulado en http://127.0.0.1:${puerto} · ${canales} canal(es) · ${usuario}/${password}`));
