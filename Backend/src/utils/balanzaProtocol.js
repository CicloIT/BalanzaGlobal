// Protocolo de la balanza (conversor RS232→TCP). Lo usan el backend (modo directo)
// y el agente local (Agente/src/balanzaProtocol.js es una copia: mantenerlas iguales).
//
// Formatos soportados:
//  A) Una línea con '|' terminada en LF:  ":00|6893|000060|000000|000060|12\r\n"
//     Índices: [0] status  [1] ID  [2] PESO  [3] TARA  [4] NETO  [5] checksum
//  B) Bloque STX ... ETX con un campo por renglón (campos alineados a la derecha):
//     02 "         1\r\n" "     49420\r\n" "         0\r\n" 03
//     Renglones: [0] estado  [1] PESO  [2] estado
//  C) Bloque STX ... ETX con un solo renglón, que es el peso:
//     02 "      -180\r\n" 03

const STX = 0x02;
const ETX = 0x03;
const LF = 0x0a;
const MAX_BUFFER = 4096;   // si nunca llega el fin de una trama, no acumular sin límite

const aEntero = (raw) => (raw !== undefined && /^-?\d+$/.test(raw) ? parseInt(raw, 10) : null);

// Recibe la trama ya limpia (cleanFrame) y devuelve el peso en kg o null.
export const parseFrame = (clean) => {
    if (clean.includes('|')) {
        const parts = clean.split('|').map(p => p.replace(/^:/, '').trim());
        return aEntero(parts[2]);
    }
    const renglones = clean.split('\n').map(l => l.trim()).filter(Boolean);
    const raw = renglones.length === 1 ? renglones[0] : renglones[1];   // C: único renglón; B: el segundo
    return raw !== undefined ? aEntero(raw.replace(/\s+/g, '')) : null;
};

// Limpia una trama cruda: saca STX/ETX/CR. Deja los LF (separan renglones del formato B).
export const cleanFrame = (frame) => frame.toString('ascii').replace(/[\x02\x03\r]/g, '').trim();

// Separa un buffer acumulado en tramas. Devuelve { frames, rest }.
// Si aparece un STX antes del próximo LF, la trama va hasta el ETX (formato B);
// si no, la trama termina en LF (formato A).
export const splitFrames = (buffer) => {
    const frames = [];
    for (;;) {
        const stx = buffer.indexOf(STX);
        const lf = buffer.indexOf(LF);
        if (stx !== -1 && (lf === -1 || stx < lf)) {
            const etx = buffer.indexOf(ETX, stx + 1);
            if (etx === -1) {
                buffer = buffer.subarray(stx);   // esperar el resto del bloque
                break;
            }
            frames.push(buffer.subarray(stx, etx + 1));
            buffer = buffer.subarray(etx + 1);
            continue;
        }
        if (lf === -1) break;
        frames.push(buffer.subarray(0, lf + 1));
        buffer = buffer.subarray(lf + 1);
    }
    if (buffer.length > MAX_BUFFER) buffer = buffer.subarray(buffer.length - MAX_BUFFER);
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
