// Configuración de pm2 para el backend. Uso: ./arrancar.sh (o pm2 startOrReload ecosystem.config.cjs)
// Versionado en git: si se pierde la lista de pm2 (container reiniciado), se vuelve a levantar igual.
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'balanza',
      cwd: path.join(__dirname, 'Backend'),
      script: 'src/server.js',
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 50,
      max_memory_restart: '600M', // reinicia antes de que el container se quede sin RAM
      time: true,                 // logs con fecha
    },
  ],
};
