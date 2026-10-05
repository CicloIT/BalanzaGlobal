import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || '123'),
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'balanzaglobal',
});


pool.on('error', (err) => {
  console.error('Error en pool de conexión:', err);
});

pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

export default pool;
