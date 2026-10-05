import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import archiver from 'archiver';
import pool from '../config/database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '../../');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups');
const CAPTURAS_DIR = path.join(ROOT_DIR, 'capturas');
const DOCUMENTOS_DIR = path.join(__dirname, '../documentos');

let PG_DUMP_PATH = process.env.PG_DUMP_PATH;
if (!PG_DUMP_PATH) {
  const possiblePaths = [
    'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe',
    'C:/Program Files/PostgreSQL/17/bin/pg_dump.exe',
    'C:/Program Files/PostgreSQL/16/bin/pg_dump.exe',
    'C:/Program Files/PostgreSQL/15/bin/pg_dump.exe',
    'C:/Program Files/PostgreSQL/14/bin/pg_dump.exe',
    '/usr/bin/pg_dump',
    '/usr/local/bin/pg_dump'
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) { PG_DUMP_PATH = p; break; }
    } catch (e) { /* ignorar */ }
  }
  if (!PG_DUMP_PATH) PG_DUMP_PATH = 'pg_dump';
}

const getPgDumpCommand = () =>
  PG_DUMP_PATH.includes(' ') ? `"${PG_DUMP_PATH}"` : PG_DUMP_PATH;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const slugLocalidad = (nombre) =>
  nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

const getNombreLocalidad = async (localidadId) => {
  if (!localidadId) return null;
  const result = await pool.query('SELECT nombre FROM localidad WHERE id = $1', [localidadId]);
  return result.rows.length ? slugLocalidad(result.rows[0].nombre) : null;
};

// localidadId: número o null (global)
export const createBackup = async (localidadId = null) => {
  const localidadNombre = await getNombreLocalidad(localidadId);
  const backupSubDir = localidadNombre ? path.join(BACKUP_DIR, localidadNombre) : BACKUP_DIR;
  if (!fs.existsSync(backupSubDir)) fs.mkdirSync(backupSubDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    + '_' + new Date().getHours() + '-' + new Date().getMinutes();
  const backupName = `Respaldo_${timestamp}`;
  const zipPath = path.join(backupSubDir, `${backupName}.zip`);
  const dumpFile = path.join(backupSubDir, `temp_db_${timestamp}.sql`);

  console.log(`🚀 Iniciando respaldo [${localidadNombre ?? 'global'}]: ${backupName}...`);

  return new Promise((resolve, reject) => {
    const dbPass = process.env.DB_PASSWORD || '123';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbName = process.env.DB_NAME || 'balanzaglobal';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';

    const env = { ...process.env, PGPASSWORD: dbPass };
    const dumpCmd = `${getPgDumpCommand()} -h ${dbHost} -p ${dbPort} -U ${dbUser} -F p -b -v -f "${dumpFile}" ${dbName}`;

    exec(dumpCmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error en pg_dump:', stderr);
        return reject(new Error('Error al exportar base de datos'));
      }

      console.log('✅ Base de datos exportada. Iniciando compresión...');

      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`✅ Respaldo completado: ${zipPath} (${archive.pointer()} bytes)`);
        if (fs.existsSync(dumpFile)) fs.unlinkSync(dumpFile);
        resolve({
          success: true,
          filename: `${backupName}.zip`,
          path: zipPath,
          size: archive.pointer()
        });
      });

      archive.on('error', (err) => {
        console.error('❌ Error en compresión:', err);
        reject(err);
      });

      archive.pipe(output);
      archive.file(dumpFile, { name: 'database.sql' });

      // Solo incluir capturas de esta localidad
      const capturasLocalidad = localidadNombre
        ? path.join(CAPTURAS_DIR, localidadNombre)
        : CAPTURAS_DIR;
      if (fs.existsSync(capturasLocalidad)) {
        archive.directory(capturasLocalidad, 'capturas');
      }

      if (fs.existsSync(DOCUMENTOS_DIR)) {
        archive.directory(DOCUMENTOS_DIR, 'documentos');
      }

      archive.finalize();
    });
  });
};

export const handleManualBackup = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const result = await createBackup(localidadId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const listBackups = async (req, res) => {
  try {
    const localidadId = req.user?.localidad_id ?? null;
    const localidadNombre = await getNombreLocalidad(localidadId);
    const dir = localidadNombre ? path.join(BACKUP_DIR, localidadNombre) : BACKUP_DIR;

    if (!fs.existsSync(dir)) {
      return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(dir, f));
        return { filename: f, size: stats.size, date: stats.mtime };
      })
      .sort((a, b) => b.date - a.date);

    res.json({ success: true, backups: files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    // Prevenir path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const localidadId = req.user?.localidad_id ?? null;
    const localidadNombre = await getNombreLocalidad(localidadId);
    const dir = localidadNombre ? path.join(BACKUP_DIR, localidadNombre) : BACKUP_DIR;
    const filePath = path.join(dir, filename);

    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
