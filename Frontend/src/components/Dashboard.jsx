import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { useThemeContext } from '../context/ThemeContext';
import {
  Scale,
  TrendingUp,
  Users,
  Package,
  Truck,
  Calendar,
  FileText,
  Activity
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

// Colores para gráficos
const COLORS = {
  primary: ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
  dark: {
    bg: '#1e293b',
    text: '#e2e8f0',
    grid: '#334155'
  },
  light: {
    bg: '#ffffff',
    text: '#1e293b',
    grid: '#e2e8f0'
  }
};


// --- Componentes Premium (Phase 2) ---

// Componente de mini-gráfico (Sparkline)
const Sparkline = ({ data, color }) => (
  <div className="h-8 w-16 opacity-50">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// Componente de tarjeta de métrica optimizado (Senior BI)
const MetricCard = ({ icon: Icon, title, value, subtitle, trend, color, sparkData }) => {
  const { isDark } = useThemeContext();

  return (
    <div className={`p-6 rounded-[2rem] transition-all duration-500 hover:scale-[1.02] relative overflow-hidden group ${isDark
      ? 'bg-slate-800/40 border border-white/10 backdrop-blur-xl hover:bg-slate-800/60'
      : 'bg-white/80 border border-slate-200/60 shadow-xl shadow-slate-200/50 hover:bg-white'
      }`}>
      {/* Glow Effect */}
      <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full blur-3xl opacity-20 transition-all duration-500 group-hover:scale-150 ${color}`} />

      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={`p-4 rounded-2xl ${color} bg-opacity-20 text-white shadow-inner`}>
          <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
        <div className="text-right">
          {trend && (
            <div className={`flex items-center gap-1 text-sm font-bold ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
              {trend > 0 ? <TrendingUp size={14} /> : <Activity size={14} />}
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
          {sparkData && <Sparkline data={sparkData} color={color.includes('blue') ? '#3b82f6' : '#10b981'} />}
        </div>
      </div>

      <div className="relative z-10">
        <h3 className={`text-3xl font-black mb-1 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {value}
        </h3>
        <p className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {title}
        </p>
        {subtitle && (
          <p className={`text-xs mt-3 px-3 py-1 rounded-full inline-block ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

// Componente de Mapa de Calor (Heatmap)
const ActivityHeatmap = ({ data, isDark }) => {
  const horas = Array.from({ length: 24 }, (_, i) => i);
  const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

  const getIntensity = (total) => {
    if (total === 0) return isDark ? 'bg-slate-700/30' : 'bg-slate-200';
    if (total < 5) return 'bg-blue-400/30';
    if (total < 10) return 'bg-blue-400/55';
    if (total < 20) return 'bg-blue-500/80';
    return 'bg-blue-500';
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        {/* Leyenda de intensidad */}
        <div className="flex items-center gap-2 mb-3 justify-end">
          <span className={`text-[10px] font-bold opacity-50 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Menos</span>
          {[0, 3, 7, 15, 25].map((v, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-sm ${getIntensity(v)}`}
              title={`${v} pesadas`}
            />
          ))}
          <span className={`text-[10px] font-bold opacity-50 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Más</span>
        </div>
        {/* Header Horas */}
        <div className="grid grid-cols-[56px_repeat(24,1fr)] gap-[3px] mb-2">
          <div />
          {horas.map(h => (
            <div key={h} className={`text-[9px] text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}h</div>
          ))}
        </div>
        {/* Grid de Datos */}
        {dias.map((d, i) => (
          <div key={d} className="grid grid-cols-[56px_repeat(24,1fr)] gap-[3px] mb-[3px]">
            <div className={`text-xs font-bold flex items-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{d}</div>
            {horas.map(h => {
              const cell = data.find(item => item.dia === i && item.hora === h);
              const total = cell ? cell.total : 0;
              return (
                <div
                  key={h}
                  className={`relative h-5 rounded-sm transition-all duration-200 hover:scale-125 hover:z-10 cursor-default group/cell ${getIntensity(total)}`}
                  title={`${d} ${h}:00 — ${total} pesadas`}
                >
                  {/* Tooltip CSS puro */}
                  <div className={`
                    absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap
                    pointer-events-none opacity-0 group-hover/cell:opacity-100 transition-opacity z-50
                    ${isDark
                      ? 'bg-slate-900 text-white border border-white/10 shadow-xl'
                      : 'bg-white text-slate-800 border border-slate-200 shadow-xl'
                    }
                  `}>
                    {d} {h}:00 – {total} pesadas
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// Componente de gráfico con título premium
const ChartCard = ({ title, children, className = '', subtitle }) => {
  const { isDark } = useThemeContext();

  return (
    <div className={`p-8 rounded-[2.5rem] transition-all duration-500 relative group overflow-hidden ${isDark
      ? 'bg-slate-900/40 border border-white/5 backdrop-blur-2xl'
      : 'bg-white border border-slate-200 shadow-2xl shadow-slate-200/40'
      } ${className}`}>
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h3>
          {subtitle && <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500 opacity-60'}`}>{subtitle}</p>}
        </div>
        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      </div>
      <div className="relative z-10 h-[calc(100%-60px)]">
        {children}
      </div>
    </div>
  );
};

const STORAGE_KEY = 'balanza_user';

// Helper para obtener headers con información del usuario
const getAuthHeaders = (contentType = 'application/json') => {
  const headers = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      if (user?.id) {
        headers['x-user-id'] = user.id.toString();
      }
      if (user?.username) {
        headers['x-username'] = user.username;
      }
    }
  } catch {
    // Ignorar errores
  }

  return headers;
};

export default function Dashboard() {
  const { isDark } = useThemeContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metricas, setMetricas] = useState(null);

  // Cargar métricas
  useEffect(() => {
    const fetchMetricas = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/metricas/dashboard`, {
          headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
          setMetricas(data.data);
        } else {
          setError(data.error || 'Error al cargar métricas');
        }
      } catch (err) {
        setError('Error de conexión con el servidor');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetricas();

    // Actualizar cada 30 segundos
    const interval = setInterval(fetchMetricas, 30000);
    return () => clearInterval(interval);
  }, []);

  // Formatear peso
  const formatPeso = (kg) => {
    if (kg === undefined || kg === null || isNaN(kg)) return '0 kg';
    if (kg >= 1000000) {
      return `${(kg / 1000000).toFixed(2)}M kg`;
    } else if (kg >= 1000) {
      return `${(kg / 1000).toFixed(2)}k kg`;
    }
    return `${kg.toFixed(0)} kg`;
  };

  // Formatear número
  const formatNumero = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString('es-AR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className={`animate-spin rounded-full h-24 w-24 border-t-2 border-b-2 ${isDark ? 'border-cyan-400' : 'border-blue-600'}`}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Scale size={20} className={isDark ? 'text-cyan-400' : 'text-blue-600'} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-12 rounded-[3rem] text-center max-w-2xl mx-auto border transition-all ${isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
        <Activity size={64} className="mx-auto mb-6 text-rose-500/50 animate-bounce" />
        <h4 className="text-2xl font-black mb-2">Error Crítico de Datos</h4>
        <p className="opacity-80 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 rounded-full bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/30"
        >
          Reintentar Conexión
        </button>
      </div>
    );
  }

  if (!metricas) return null;
  const {
    hoy = {},
    semana = [],
    topProductores = [],
    topProductos = [],
    topTransportes = [],
    topChoferes = [],
    distribucionVehiculos = [],
    estadisticasMes = {},
    comparativoMensual = [],
    actividadHeatmap = [],
    eficiencia = { promedioMinutos: 0 }
  } = metricas;

  // Preparar datos para gráficos
  const datosSemana = semana.map(d => ({
    ...d,
    fecha: d.fecha ? new Date(d.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }) : ''
  }));

  const sparkDataPeso = semana.slice(-7).map(d => ({ v: d.neto || 0 }));
  const sparkDataPesadas = semana.slice(-7).map(d => ({ v: d.total || 0 }));

  const datosProductores = topProductores.slice(0, 5).map((p, i) => ({
    name: (p.nombre || '').length > 20 ? p.nombre.substring(0, 20) + '...' : (p.nombre || 'N/A'),
    peso: p.pesoNeto || 0,
    color: COLORS.primary[i % COLORS.primary.length]
  }));

  const datosTransportes = topTransportes.slice(0, 5).map((t, i) => ({
    name: (t.nombre || '').length > 20 ? t.nombre.substring(0, 20) + '...' : (t.nombre || 'N/A'),
    peso: t.pesoNeto || 0,
    color: COLORS.primary[i % COLORS.primary.length]
  }));

  const datosChoferes = topChoferes.slice(0, 5).map((c, i) => ({
    name: c.nombre || 'N/A',
    ops: c.operaciones || 0,
    color: COLORS.primary[i % COLORS.primary.length]
  }));

  const datosDistribucion = distribucionVehiculos.map((v, i) => ({
    name: (v.tipo || 'OTRO').replace(/_/g, ' '),
    value: v.pesoNeto || 0,
    color: COLORS.primary[i % COLORS.primary.length]
  }));

  const datosMensual = comparativoMensual;

  return (
    <div className="space-y-8 pb-16 animate-fadeIn">
      {/* Header Elevado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <span className={`text-xs font-black uppercase tracking-[0.3em] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            Operations Dashboard
          </span>
          <h2 className={`text-5xl font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tighter mt-1`}>
            Visión General
          </h2>
        </div>
        <div className={`flex items-center gap-4 px-6 py-3 rounded-[1.5rem] shadow-2xl transition-all ${isDark ? 'bg-slate-800/80 border border-white/10 text-slate-100' : 'bg-white border border-slate-100 text-slate-800 font-bold'
          }`}>
          <div className="flex flex-col items-end">
            <span className="text-[10px] opacity-40 uppercase font-black">Servidor en línea</span>
            <span className="text-sm font-black">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </div>
          <Calendar size={28} className="text-blue-500" />
        </div>
      </div>

      {/* KPIs con Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <MetricCard
          icon={Scale}
          title="Peso Neto Hoy"
          value={formatPeso(hoy.bruto - hoy.tara)}
          subtitle={`${formatNumero(hoy.pesadas)} registros`}
          trend={12}
          color="bg-blue-600"
          sparkData={sparkDataPeso}
        />
        <MetricCard
          icon={Activity}
          title="Frecuencia Hoy"
          value={formatNumero(hoy.pesadas)}
          subtitle="Tickets generados"
          trend={-5}
          color="bg-emerald-600"
          sparkData={sparkDataPesadas}
        />
        <MetricCard
          icon={Truck}
          title="Operaciones"
          value={hoy.operaciones}
          subtitle={`${hoy.operacionesAbiertas} abiertas en playa`}
          color="bg-amber-500"
        />
        <MetricCard
          icon={Activity}
          title="Tiempo de Proceso"
          value={`${eficiencia.promedioMinutos} min`}
          subtitle="Promedio por camión"
          color="bg-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico Principal Fluido */}
        <ChartCard
          title="Flujo logístico semanal"
          subtitle="Distribución de cargas brutas y taras"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datosSemana} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
              <defs>
                <linearGradient id="colorBruto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTara" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="10 10" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
              <XAxis
                dataKey="fecha"
                stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                tick={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                tick={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#475569' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px -12px rgba(0,0,0,0.4)',
                  padding: '12px 16px'
                }}
                itemStyle={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}
                labelStyle={{ fontSize: '11px', fontWeight: 900, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}
                formatter={(value, name) => [formatPeso(value), name === 'bruto' ? '🟢 Bruto' : '🔵 Tara']}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: isDark ? '#e2e8f0' : '#475569'
                  }}>
                    {value === 'bruto' ? '🟢 Peso Bruto' : '🔵 Tara'}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="bruto"
                name="bruto"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#colorBruto)"
                animationDuration={2000}
              />
              <Area
                type="monotone"
                dataKey="tara"
                name="tara"
                stroke="#3b82f6"
                strokeWidth={3}
                fill="url(#colorTara)"
                animationDuration={2500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Heatmap de Actividad */}
        <ChartCard
          title="Mapa de Calor Energético"
          subtitle="Intensidad de pesaje por hora"
        >
          <ActivityHeatmap data={actividadHeatmap} isDark={isDark} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ranking de Transportes */}
        <ChartCard title="Transportistas Líderes" subtitle="Tonelaje movido por empresa (Mes)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datosTransportes}
              layout="vertical"
              margin={{ left: 10, right: 80, top: 4, bottom: 4 }}
              barCategoryGap="30%"
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fontWeight: 700, fill: isDark ? '#cbd5e1' : '#334155' }}
                width={110}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                contentStyle={{
                  borderRadius: '14px',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  fontWeight: 700
                }}
                formatter={(value) => [formatPeso(value), 'Carga Neta']}
              />
              <Bar dataKey="peso" radius={[0, 8, 8, 0]} barSize={28}>
                {datosTransportes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="peso"
                  position="right"
                  formatter={(v) => formatPeso(v)}
                  style={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#64748b' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Uso de Flota — lista de tarjetas */}
        <ChartCard title="Uso de Flota" subtitle="Carga por tipo de vehículo">
          <div className="space-y-3 overflow-y-auto max-h-[280px] pr-1">
            {datosDistribucion.length === 0 ? (
              <p className={`text-sm text-center py-8 opacity-40 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Sin datos disponibles</p>
            ) : (
              datosDistribucion.map((item, i) => {
                const maxVal = Math.max(...datosDistribucion.map(d => d.value));
                const pct = maxVal > 0 ? Math.round((item.value / maxVal) * 100) : 0;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all hover:scale-[1.01] ${isDark
                      ? 'bg-slate-800/50 border-white/8 hover:bg-slate-700/60'
                      : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-md'
                      }`}
                  >
                    {/* Pastilla de color + ícono */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    >
                      {i + 1}
                    </div>
                    {/* Nombre + barra de progreso */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate mb-1 ${isDark ? 'text-slate-100' : 'text-slate-800'
                        }`}>{item.name}</p>
                      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                    {/* Valor */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-900'
                        }`}>{formatPeso(item.value)}</p>
                      <p className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>{pct}%</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ranking de Productores */}
        <ChartCard title="Líderes de Producción" subtitle="Top 5 productores">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datosProductores}
              layout="vertical"
              margin={{ left: 10, right: 80, top: 4, bottom: 4 }}
              barCategoryGap="28%"
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fontWeight: 700, fill: isDark ? '#cbd5e1' : '#334155' }}
                width={110}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                contentStyle={{
                  borderRadius: '14px',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  fontWeight: 700
                }}
                formatter={(value) => [formatPeso(value), 'Carga Total']}
              />
              <Bar dataKey="peso" radius={[0, 8, 8, 0]} barSize={22}>
                {datosProductores.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="peso"
                  position="right"
                  formatter={(v) => formatPeso(v)}
                  style={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#64748b' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Productos */}
        <ChartCard title="Productos Clave" subtitle="Flujo por mercadería">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topProductos.slice(0, 5).map((p, i) => ({
                name: p.nombre,
                peso: p.pesoNeto,
                color: COLORS.primary[i % COLORS.primary.length]
              }))}
              layout="vertical"
              margin={{ left: 10, right: 80, top: 4, bottom: 4 }}
              barCategoryGap="28%"
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#cbd5e1' : '#334155' }}
                width={100}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                contentStyle={{
                  borderRadius: '14px',
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  fontWeight: 700
                }}
                formatter={(value) => [formatPeso(value), 'Total']}
              />
              <Bar dataKey="peso" radius={[0, 8, 8, 0]} barSize={22}>
                {topProductos.slice(0, 5).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                ))}
                <LabelList
                  dataKey="peso"
                  position="right"
                  formatter={(v) => formatPeso(v)}
                  style={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#64748b' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Mejores Choferes */}
        <ChartCard title="Staff Destacado" subtitle="Top choferes">
          <div className="space-y-3 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
            {datosChoferes.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-500/5 border border-white/5 transition-all hover:bg-slate-500/10">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${c.color.replace('bg-', 'bg-')}`}>
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className={`text-sm font-bold truncate w-24 ${isDark ? 'text-white' : 'text-slate-800'}`}>{c.name}</p>
                    <p className={`text-[9px] uppercase font-black ${isDark ? 'text-slate-400' : 'text-slate-400 opacity-60'}`}>Driver</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{c.ops}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>


      {/* Footer / Resumen Consolidado */}
      <div className={`p-10 rounded-[3.5rem] relative overflow-hidden shadow-2xl ${isDark
        ? 'bg-gradient-to-br from-indigo-600 via-blue-700 to-slate-900 text-white'
        : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
        }`}>
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.4em] opacity-60 mb-2">Operaciones Mes</p>
            <p className="text-5xl font-black tracking-tighter">{formatNumero(estadisticasMes?.totalOperaciones)}</p>
            <p className="text-sm mt-2 font-bold opacity-80">Volumen procesado</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.4em] opacity-60 mb-2">Carga Neta</p>
            <p className="text-5xl font-black tracking-tighter">{formatPeso(estadisticasMes?.totalNeto)}</p>
            <p className="text-sm mt-2 font-bold opacity-80">Tonelaje consolidado</p>
          </div>
          <div className="lg:col-span-2 flex flex-col justify-center bg-white/10 p-8 rounded-[2rem] border border-white/10 backdrop-blur-md">
            <h4 className="text-xl font-black mb-1">Rendimiento Operativo</h4>
            <div className="grid grid-cols-2 gap-6 mt-2">
              <div>
                <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Tiempo Promedio</p>
                <p className="text-2xl font-black">{(eficiencia?.promedioMinutos || 0)} min</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold opacity-60 tracking-wider">Carga Promedio</p>
                <p className="text-2xl font-black">{formatPeso(estadisticasMes?.cargaPromedio)}</p>
              </div>
            </div>
            <p className="text-xs mt-3 opacity-60 font-medium">
              Eficiencia de carga: {estadisticasMes.cargaPromedio > 25000 ? 'ALTA (Capacidad aprovechada)' : 'NORMAL (Flujo estándar)'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
