// Simula conversores RS232→TCP en modo server: emiten tramas de peso cada 500 ms.
// Uso: node scripts/sim_balanzas.mjs 4101:1000 4102:5000:camion   (puerto:pesoBase[:camion])
//   sin modo  → oscila base, base+10 … base+40 (nunca estable)
//   camion    → ciclo: vacío (0) → sube con oscilación → estable en `base` ~8 s → baja → vacío
import net from 'net';

const tramaPeso = (peso) => {
  const p = (peso < 0 ? '-' : '') + String(Math.abs(Math.round(peso))).padStart(peso < 0 ? 5 : 6, '0');
  return `\x02:00|6893|${p}|000000|${p}|12\r\n\x03`;
};

// Peso del modo camión para el tick n (500 ms por tick): 4 s vacío, 3 s subida, 8 s estable, 3 s bajada
const pesoCamion = (base, n) => {
  const fases = [['vacio', 8], ['sube', 6], ['estable', 16], ['baja', 6]];
  const total = fases.reduce((a, [, t]) => a + t, 0);
  let t = n % total;
  for (const [fase, ticks] of fases) {
    if (t < ticks) {
      const f = (t + 1) / ticks;
      const ruido = Math.round((Math.random() - 0.5) * 40);
      if (fase === 'vacio') return 0;
      if (fase === 'estable') return base;
      if (fase === 'sube') return Math.max(0, Math.round(base * f) + ruido);
      return Math.max(0, Math.round(base * (1 - f)) + ruido);
    }
    t -= ticks;
  }
  return 0;
};

for (const arg of process.argv.slice(2)) {
  const [portStr, baseStr, modo] = arg.split(':');
  const port = Number(portStr);
  const base = Number(baseStr);
  net.createServer((sock) => {
    let n = 0;
    const t = setInterval(() => {
      const peso = modo === 'camion' ? pesoCamion(base, n++) : base + (n++ % 5) * 10;
      sock.write(tramaPeso(peso));
    }, 500);
    sock.on('close', () => clearInterval(t));
    sock.on('error', () => clearInterval(t));
  }).listen(port, '127.0.0.1', () => console.log(`sim balanza en ${port} (base ${base}${modo ? `, ${modo}` : ''})`));
}
