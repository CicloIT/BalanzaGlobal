// Protocolo de la balanza (conversor RS232→TCP). Lo usan el backend (modo directo)
// y el agente local (Agente/src/balanzaProtocol.js es una copia: mantenerlas iguales).

// Trama: ":00|6893|000060|000000|000060|12"
// Índices: [0] status  [1] ID  [2] PESO  [3] TARA  [4] NETO  [5] checksum
// El peso está en el campo índice 2 (e.g. "000060" → 60 kg, o "-00020" → -20 kg)
export const parseFrame = (clean) => {
    const parts = clean.split('|').map(p => p.replace(/^:/, '').trim());
    const rawWeight = parts[2];
    return rawWeight !== undefined && /^-?\d+$/.test(rawWeight)
        ? parseInt(rawWeight, 10)
        : null;
};

// Limpia una trama cruda (con STX/ETX/CR) antes de parsearla
export const cleanFrame = (frame) => frame.toString('ascii').replace(/[\x02\x03\r]/g, '').trim();

// Separa un buffer acumulado en tramas terminadas en '\n'. Devuelve { frames, rest }.
export const splitFrames = (buffer) => {
    const frames = [];
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
        frames.push(buffer.subarray(0, idx + 1));
        buffer = buffer.subarray(idx + 1);
    }
    return { frames, rest: buffer };
};

// Estable = el peso no varió más de `toleranciaKg` durante al menos `ventanaMs`
// y con al menos `minLecturas` lecturas en ese lapso.
export const createStabilityTracker = ({ ventanaMs = 1500, minLecturas = 3, toleranciaKg = 0 } = {}) => {
    let lecturas = [];   // { weight, ts }
    return (weight, ts = Date.now()) => {
        if (weight === null) return false;
        const base = lecturas[0];
        if (base && Math.abs(base.weight - weight) > toleranciaKg) lecturas = [];
        lecturas.push({ weight, ts });
        if (lecturas.length > 50) lecturas = lecturas.slice(-50);
        return lecturas.length >= minLecturas && ts - lecturas[0].ts >= ventanaMs;
    };
};
