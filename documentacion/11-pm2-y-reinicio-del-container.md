# 11 — pm2 y reinicio del container (Daytona)

Al parar y volver a arrancar el container de Daytona, **PostgreSQL y el backend no levantan solos**
y `pm2 restart all` no encuentra nada. Causa:

- pm2 guarda su lista de procesos en memoria. Si nunca se hizo `pm2 save`, al reiniciar no queda nada que restaurar.
- `pm2 startup` (arranque automático) usa systemd, que **no existe dentro del container**.
- PostgreSQL tampoco tiene quien lo inicie.

Solución: la configuración de pm2 y un script de arranque **están en el repo**, así que se
recuperan siempre con un solo comando.

| Archivo | Qué hace |
|---|---|
| `ecosystem.config.cjs` | Define el proceso `balanza` (carpeta, script, reinicio automático, límite de RAM) |
| `arrancar.sh` | Inicia PostgreSQL si está parado, levanta/recarga `balanza` con pm2, hace `pm2 save` y verifica |

## Después de cada reinicio del container

```bash
cd /root/BalanzaGlobal && ./arrancar.sh
```

Se puede correr las veces que sea: si todo ya está arriba, solo recarga el backend. Salida esperada:

```
/var/run/postgresql:5432 - accepting connections
┌────┬────────────┬ ... ┬──────────┐
│ 0  │ balanza    │ ... │ online   │
Backend: HTTP 200
```

Si dice `Permission denied`: `chmod +x arrancar.sh` (una vez).

## Una sola vez: pasar al ecosystem

Si `balanza` se había levantado a mano con `pm2 start src/server.js --name balanza`:

```bash
cd /root/BalanzaGlobal
git pull
pm2 delete balanza        # el proceso viejo
./arrancar.sh             # lo crea de nuevo desde ecosystem.config.cjs y hace pm2 save
```

## Opcional: que arranque solo al entrar por ssh

Daytona no corre nada propio al iniciar el container, pero sí se ejecuta `~/.bashrc` al entrar por
ssh. Con esto, la primera conexión después de un reinicio levanta todo sola:

```bash
cat >> ~/.bashrc <<'EOF'

# Balanza: levantar Postgres + backend si el container se reinició
if ! pm2 pid balanza 2>/dev/null | grep -q '[1-9]'; then
  /root/BalanzaGlobal/arrancar.sh
fi
EOF
```

Ojo: **hasta que alguien entre por ssh el sistema sigue caído**. Es una ayuda, no un arranque automático real.

## Actualizar sin que se caiga el container

`npm run build` del frontend usa mucha RAM; con el backend y Postgres corriendo, el container se
puede quedar sin memoria y caerse (pasó en los deploys del 29 y 30/10). Liberar memoria primero:

```bash
cd /root/BalanzaGlobal
git pull --ff-only                       # ver doc 06: antes respaldar Backend/src/documentos
pm2 stop balanza                         # libera la RAM del backend durante el build
cd Frontend && NODE_OPTIONS=--max-old-space-size=512 npm run build && cd ..
./arrancar.sh                            # vuelve a levantar el backend
```

`max_memory_restart: '600M'` en el ecosystem reinicia el backend si pasa ese consumo, antes de que
tumbe el container.

## Comandos útiles

| Comando | Para qué |
|---|---|
| `pm2 status` | Ver si `balanza` está `online` |
| `pm2 logs balanza --lines 50 --nostream` | Últimas líneas del log (debe decir "Conectado a PostgreSQL") |
| `pm2 restart balanza --update-env` | Reiniciar tomando cambios del `.env` |
| `pm2 resurrect` | Restaurar la última lista guardada con `pm2 save` |
| `free -m` / `df -h /` | Memoria y disco libres (disco lleno o poca RAM = caídas) |
| `pg_isready -h 127.0.0.1` | ¿Postgres responde? |

## Si el container se **borra** (no solo se para)

Parar y arrancar conserva el disco. Si el container se elimina o se recrea, el repo se vuelve a
clonar, pero **esto no está en git y se pierde**:

| Qué | Dónde | Cómo resguardarlo |
|---|---|---|
| Base de datos | PostgreSQL | *Respaldos* en la app (superadmin) → descargar el `.zip` |
| `.env` (claves, `SESSION_SECRET`) | `Backend/.env` | Guardar una copia fuera del container |
| Fotos de cámaras | `Backend/capturas/` | Van en el `.zip` de respaldo |
| PDF de operaciones | `Backend/src/documentos/` | Van en el `.zip` de respaldo |

Bajar un respaldo **antes** de cualquier cambio grande y cada tanto. Para reconstruir desde cero:
mismos pasos que la mudanza a VPS (doc 06), restaurando ese respaldo, y después `./arrancar.sh`.
