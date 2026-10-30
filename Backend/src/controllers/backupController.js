import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import pool from '../config/database.js';
import { sendScopeError } from '../utils/scope.js';

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

// Respaldo completo: base entera + capturas + documentos. Solo para administradores globales.
export const createBackup = async () => {
  const backupSubDir = BACKUP_DIR;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    + '_' + new Date().getHours() + '-' + new Date().getMinutes();
  const backupName = `Respaldo_${timestamp}`;
  const zipPath = path.join(backupSubDir, `${backupName}.zip`);
  const dumpFile = path.join(backupSubDir, `temp_db_${timestamp}.sql`);

  console.log(`🚀 Iniciando respaldo: ${backupName}...`);

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

      if (fs.existsSync(CAPTURAS_DIR)) {
        archive.directory(CAPTURAS_DIR, 'capturas');
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
    const result = await createBackup();
    res.json(result);
  } catch (error) {
    sendScopeError(res, error);
  }
};

export const listBackups = async (req, res) => {
  try {
    const dir = BACKUP_DIR;

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
    sendScopeError(res, error);
  }
};

export const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    // Prevenir path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const filePath = path.join(BACKUP_DIR, filename);

    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (error) {
    sendScopeError(res, error);
  }
};
