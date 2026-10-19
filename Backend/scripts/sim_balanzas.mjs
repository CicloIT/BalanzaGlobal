// Simula conversores RS232→TCP en modo server: emiten tramas de peso cada 500 ms.
// Uso: node scripts/sim_balanzas.mjs 4101:1000 4102:5000   (puerto:pesoBase)
import net from 'net';

for (const arg of process.argv.slice(2)) {
  const [port, base] = arg.split(':').map(Number);
  net.createServer((sock) => {
    let n = 0;
    const t = setInterval(() => {
      const peso = String(base + (n++ % 5) * 10).padStart(6, '0');
      sock.write(`\x02:00|6893|${peso}|000000|${peso}|12\r\n\x03`);
    }, 500);
    sock.on('close', () => clearInterval(t));
    sock.on('error', () => clearInterval(t));
  }).listen(port, '127.0.0.1', () => console.log(`sim balanza en ${port} (base ${base})`));
}
