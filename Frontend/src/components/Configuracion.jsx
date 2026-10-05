import React, { useState, useEffect } from 'react';
import { Database, Download, Play, Calendar, CheckCircle2, AlertCircle, RefreshCw, FileArchive, ShieldCheck, Clock } from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import DispositivosConfig from './DispositivosConfig';
const API_BASE_URL = '';
const STORAGE_KEY = 'balanza_user';

const getAuthHeaders = (contentType = 'application/json') => {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      if (user?.id) headers['x-user-id'] = user.id.toString();
      if (user?.username) headers['x-username'] = user.username;
    }
  } catch { /* ignore */ }
  return headers;
};

export default function Configuracion() {
  const { isDark } = useThemeContext();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/backup/list`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    if (!window.confirm('¿Desea iniciar un respaldo completo ahora? Esto puede demorar unos segundos.')) return;

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`${API_BASE_URL}/api/backup/trigger`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(`Respaldo creado exitosamente: ${data.filename}`);
        fetchBackups();
      } else {
        throw new Error(data.error || 'Error al crear respaldo');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const headers = getAuthHeaders(null);
      const res = await fetch(`${API_BASE_URL}/api/backup/download/${filename}`, {
        headers
      });

      if (!res.ok) throw new Error('No se pudo descargar el archivo');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 animate-fadeIn">

      <div>
        <h2 className={`text-xl font-black mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Configuración de Dispositivos
        </h2>
        <DispositivosConfig />
      </div>

      {/* Header Section */}
      <div className={`backdrop-blur-xl rounded-3xl p-8 border transition-all shadow-2xl ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white/80 border-slate-200'
        }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`p-4 rounded-2xl shadow-xl ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-500 text-white shadow-indigo-500/20'}`}>
              <Database size={32} />
            </div>
            <div>
              <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Gestión de Respaldos</h2>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Seguridad total para tus datos y archivos</p>
            </div>
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-lg transition-all shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
              }`}
          >
            {creating ? <RefreshCw className="animate-spin" size={24} /> : <Play size={24} />}
            {creating ? 'PROCESANDO...' : 'RESPALDAR AHORA'}
          </button>
        </div>

        {error && (
          <div className="mt-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 font-bold">
            <AlertCircle size={20} /> {error}
          </div>
        )}
        {success && (
          <div className="mt-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-500 font-bold">
            <CheckCircle2 size={20} /> {success}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Info Cards */}
        <div className="lg:col-span-1 space-y-6">
          <div className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className="flex items-center gap-3 mb-4 text-indigo-500">
              <Calendar size={24} />
              <h4 className="font-black text-lg">Programación</h4>
            </div>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              El sistema realiza un respaldo automático completo todos los <span className="font-bold text-indigo-500">Domingos a las 03:00 AM</span>.
            </p>
            <div className={`mt-6 p-4 rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-wider">
                <ShieldCheck size={14} /> Sistema Protegido
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className="flex items-center gap-3 mb-4 text-blue-500">
              <Clock size={24} />
              <h4 className="font-black text-lg">Historial</h4>
            </div>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Se mantienen los archivos en el servidor bajo la carpeta <code className="px-2 py-0.5 rounded bg-black/20 font-mono text-xs">/backups</code>.
            </p>
          </div>
        </div>

        {/* Backup List */}
        <div className="lg:col-span-2">
          <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-xl'}`}>
            <div className="p-6 border-b border-inherit">
              <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Archivos de Respaldo</h3>
            </div>
            <div className="divide-y divide-inherit max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-indigo-500" size={32} /></div>
              ) : backups.length === 0 ? (
                <div className="p-12 text-center opacity-40 font-bold">No hay respaldos generados aún</div>
              ) : (
                backups.map((b, idx) => (
                  <div key={idx} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-indigo-500/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${isDark ? 'bg-slate-700 group-hover:bg-indigo-500/20' : 'bg-slate-100 group-hover:bg-indigo-50'}`}>
                        <FileArchive size={24} className="text-indigo-500" />
                      </div>
                      <div>
                        <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{b.filename}</div>
                        <div className="flex items-center gap-3 text-xs opacity-50 font-medium">
                          <span>{new Date(b.date).toLocaleString()}</span>
                          <span className="w-1 h-1 rounded-full bg-current"></span>
                          <span>{formatSize(b.size)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(b.filename)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${isDark ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white' : 'border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                        }`}
                    >
                      <Download size={16} /> Descargar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
