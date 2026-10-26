// Agente local de balanzas: lee las balanzas del sitio por la LAN y las publica al
// backend central por una conexión WSS saliente (un token por balanza).
// Uso: node src/index.js sitios/<sitio>.json     (o AGENTE_CONFIG=ruta.json)
import fs from 'fs';
import path from 'path';
import { AgenteBalanza } from './agenteBalanza.js';

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const rutaConfig = process.argv[2] || process.env.AGENTE_CONFIG;
if (!rutaConfig) {
    console.error('Uso: node src/index.js <config.json>   (ver sitios/ejemplo.json)');
    process.exit(1);
}

let config;
try {
    config = JSON.parse(fs.readFileSync(path.resolve(rutaConfig), 'utf8'));
} catch (err) {
    console.error(`No se pudo leer la config ${rutaConfig}:`, err.message);
    process.exit(1);
}

const errores = [];
if (!/^wss?:\/\//.test(config.central || '')) errores.push('"central" debe ser una URL ws:// o wss:// (…/agent)');
if (!Array.isArray(config.balanzas) || !config.balanzas.length) errores.push('"balanzas" debe tener al menos una balanza');
(config.balanzas || []).forEach((b, i) => {
    if (!b.token) errores.push(`balanzas[${i}] sin "token" (generarlo en Configuración de Dispositivos o con Backend/scripts/agente_token.mjs)`);
    if (b.ip || b.puerto) console.warn(`⚠️  balanzas[${i}]: "ip"/"puerto" se ignoran; se configuran en Configuración de Dispositivos (central)`);
});
if (errores.length) {
    errores.forEach(e => console.error('❌', e));
    process.exit(1);
}

const sitio = config.sitio || path.basename(rutaConfig, '.json');
console.log(`Agente de balanzas v${VERSION} · sitio ${sitio} · ${config.balanzas.length} balanza(s) → ${config.central}`);

const agentes = config.balanzas.map((b, i) => new AgenteBalanza(
    { nombre: b.nombre || `balanza ${i + 1}`, token: b.token },
    { sitio, central: config.central, headers: config.headers, version: VERSION },
));
agentes.forEach(a => a.start());

const salir = () => {
    console.log('Deteniendo agente...');
    agentes.forEach(a => a.stop());
    setTimeout(() => process.exit(0), 300);
};
process.on('SIGINT', salir);
process.on('SIGTERM', salir);
