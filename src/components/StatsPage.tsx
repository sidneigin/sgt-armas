import { useMemo, useState, type ReactNode } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, FileText, MapPin, Shield, TrendingUp, Calendar } from 'lucide-react';
import { EventReport } from '../types';
import { applyDateFilter, defaultDateFilter, DateFilterState } from '../utils/dateFilters';
import DateFilterPanel from './DateFilterPanel';

interface StatsPageProps {
  reports: EventReport[];
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// Paleta consistente com o resto do sistema (indigo/emerald/slate)
const PIE_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7', '#64748b', '#ec4899'];

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-800 leading-tight truncate">{value}</p>
        <p className="text-[11px] text-slate-400 font-medium truncate">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 sm:p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  fontSize: '12px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

export default function StatsPage({ reports }: StatsPageProps) {
  const [dateFilter, setDateFilter] = useState<DateFilterState>(defaultDateFilter);

  const filteredReports = useMemo(() => applyDateFilter(reports, dateFilter), [reports, dateFilter]);

  const data = useMemo(() => {
    const byMonthMap = new Map<string, number>();
    const byRegionalMap = new Map<string, number>();
    const byComandoMap = new Map<string, number>();
    const byResponsavelMap = new Map<string, number>();

    for (const report of filteredReports) {
      if (report.data) {
        const monthKey = report.data.slice(0, 7);
        byMonthMap.set(monthKey, (byMonthMap.get(monthKey) || 0) + 1);
      }
      const regional = report.regional?.trim() || 'Não informado';
      byRegionalMap.set(regional, (byRegionalMap.get(regional) || 0) + 1);

      const comando = report.comando?.trim() || 'Não informado';
      byComandoMap.set(comando, (byComandoMap.get(comando) || 0) + 1);

      const responsavel = report.responsavel?.trim() || 'Não informado';
      byResponsavelMap.set(responsavel, (byResponsavelMap.get(responsavel) || 0) + 1);
    }

    const byMonth = Array.from(byMonthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => {
        const [year, month] = key.split('-');
        const idx = parseInt(month, 10) - 1;
        return { label: `${MONTH_NAMES_SHORT[idx] || month}/${year.slice(2)}`, count };
      });

    const byRegional = Array.from(byRegionalMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    const byComando = Array.from(byComandoMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const byResponsavel = Array.from(byResponsavelMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const topResponsavel = byResponsavel[0]?.name || '—';
    const regionaisDistintas = byRegionalMap.size;
    const comandosDistintos = byComandoMap.size;

    return { byMonth, byRegional, byComando, byResponsavel, topResponsavel, regionaisDistintas, comandosDistintos };
  }, [filteredReports]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 flex-wrap">
        <div>
          <h2 className="text-lg font-bold font-sans tracking-tight text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Estatísticas
          </h2>
          <p className="text-xs text-slate-400">Visão geral dos relatórios cadastrados, com gráficos.</p>
        </div>
        <div>
          <DateFilterPanel filter={dateFilter} onChange={setDateFilter} />
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
          <BarChart3 className="w-10 h-10" />
          <p className="text-sm font-semibold text-slate-500">Nenhum relatório no período selecionado</p>
          <p className="text-xs max-w-xs">Ajuste o filtro de período acima, ou cadastre relatórios para ver as estatísticas.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard icon={<FileText className="w-5 h-5" />} label="Relatórios no período" value={filteredReports.length} />
            <SummaryCard icon={<MapPin className="w-5 h-5" />} label="Regionais distintas" value={data.regionaisDistintas} />
            <SummaryCard icon={<Shield className="w-5 h-5" />} label="Comandos distintos" value={data.comandosDistintos} />
            <SummaryCard icon={<TrendingUp className="w-5 h-5" />} label="Responsável mais ativo" value={data.topResponsavel} />
          </div>

          {/* Relatórios por mês */}
          <ChartCard title="Relatórios por mês">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byMonth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="count" name="Relatórios" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Por regional */}
            <ChartCard title="Relatórios por regional">
              <div className="h-72 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byRegional}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {data.byRegional.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: '11px', maxWidth: '40%' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* Por comando */}
            <ChartCard title="Relatórios por comando (top 8)">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byComando} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="count" name="Relatórios" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          {/* Top responsáveis */}
          <ChartCard title="Top responsáveis por relatórios">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byResponsavel} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="count" name="Relatórios" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
