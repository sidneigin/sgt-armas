import { useMemo, useState } from 'react';
import { Search, Calendar, MapPin, Shield, User, Eye, Edit3, FileDown, SearchX, X } from 'lucide-react';
import { EventReport } from '../types';
import { formatDate } from '../utils/formatDate';
import { applyDateFilter, defaultDateFilter, DateFilterState } from '../utils/dateFilters';
import DateFilterPanel from './DateFilterPanel';

// Miniatura da foto do relatório (mesma ideia usada em ReportList).
function ReportThumbnail({ report }: { report: EventReport }) {
  if (!report.fotoUrl) {
    return <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />;
  }
  return (
    <img
      src={report.fotoUrl}
      alt=""
      className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
    />
  );
}

interface SearchPanelProps {
  reports: EventReport[];
  onViewReport: (report: EventReport) => void;
  onLoadEditReport: (report: EventReport) => void;
  onGenerateSinglePDF: (report: EventReport) => void;
}

export default function SearchPanel({
  reports,
  onViewReport,
  onLoadEditReport,
  onGenerateSinglePDF,
}: SearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterState>(defaultDateFilter);
  const [regionalFilter, setRegionalFilter] = useState('');
  const [comandoFilter, setComandoFilter] = useState('');
  const [responsavelFilter, setResponsavelFilter] = useState('');

  // Listas de opções, extraídas dos relatórios já cadastrados (não são fixas,
  // já que regional/comando/responsável são campos de texto livre no formulário).
  const { regionalOptions, comandoOptions, responsavelOptions } = useMemo(() => {
    const regionals = new Set<string>();
    const comandos = new Set<string>();
    const responsaveis = new Set<string>();
    reports.forEach((r) => {
      if (r.regional?.trim()) regionals.add(r.regional.trim());
      if (r.comando?.trim()) comandos.add(r.comando.trim());
      if (r.responsavel?.trim()) responsaveis.add(r.responsavel.trim());
    });
    return {
      regionalOptions: Array.from(regionals).sort((a, b) => a.localeCompare(b)),
      comandoOptions: Array.from(comandos).sort((a, b) => a.localeCompare(b)),
      responsavelOptions: Array.from(responsaveis).sort((a, b) => a.localeCompare(b)),
    };
  }, [reports]);

  const isDateFiltered = dateFilter.mode !== 'all';
  const hasAnyFilter =
    searchTerm.trim().length > 0 || isDateFiltered || !!regionalFilter || !!comandoFilter || !!responsavelFilter;

  const results = useMemo(() => {
    let list = applyDateFilter(reports, dateFilter);

    if (regionalFilter) list = list.filter((r) => r.regional === regionalFilter);
    if (comandoFilter) list = list.filter((r) => r.comando === comandoFilter);
    if (responsavelFilter) list = list.filter((r) => r.responsavel === responsavelFilter);

    const term = searchTerm.toLowerCase().trim();
    if (term) {
      list = list.filter((r) =>
        (r.numeroRelatorio && r.numeroRelatorio.toLowerCase().includes(term)) ||
        r.evento.toLowerCase().includes(term) ||
        r.regional.toLowerCase().includes(term) ||
        r.comando.toLowerCase().includes(term) ||
        r.responsavel.toLowerCase().includes(term) ||
        (r.conferidoPor && r.conferidoPor.toLowerCase().includes(term)) ||
        (r.participantes && r.participantes.toLowerCase().includes(term)) ||
        (r.descricao && r.descricao.toLowerCase().includes(term))
      );
    }

    return list;
  }, [reports, dateFilter, regionalFilter, comandoFilter, responsavelFilter, searchTerm]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setDateFilter(defaultDateFilter);
    setRegionalFilter('');
    setComandoFilter('');
    setResponsavelFilter('');
  };

  const selectClass =
    'w-full text-sm py-2 pl-3 pr-8 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 outline-none focus:ring-3 transition-all bg-white text-slate-700 disabled:opacity-50 disabled:bg-slate-50';

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col h-full overflow-hidden">
      <div className="mb-5 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold font-sans tracking-tight text-slate-800">Pesquisa Avançada</h2>
        <p className="text-xs text-slate-400">
          Combine texto livre, período, regional, comando e responsável para encontrar relatórios rapidamente.
        </p>
      </div>

      {/* Filtros */}
      <div className="space-y-3 mb-5 pb-5 border-b border-slate-100">
        {/* Busca livre */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número, evento, responsável, participantes, descrição..."
            className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 outline-none focus:ring-3 transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Limpar texto"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtros por categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Período
            </label>
            <DateFilterPanel filter={dateFilter} onChange={setDateFilter} />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Regional
            </label>
            <select
              value={regionalFilter}
              onChange={(e) => setRegionalFilter(e.target.value)}
              disabled={regionalOptions.length === 0}
              className={selectClass}
            >
              <option value="">Todas as regionais</option>
              {regionalOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Comando
            </label>
            <select
              value={comandoFilter}
              onChange={(e) => setComandoFilter(e.target.value)}
              disabled={comandoOptions.length === 0}
              className={selectClass}
            >
              <option value="">Todos os comandos</option>
              {comandoOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> Responsável
            </label>
            <select
              value={responsavelFilter}
              onChange={(e) => setResponsavelFilter(e.target.value)}
              disabled={responsavelOptions.length === 0}
              className={selectClass}
            >
              <option value="">Todos os responsáveis</option>
              {responsavelOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {hasAnyFilter && (
          <div className="flex justify-end">
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Limpar todos os filtros
            </button>
          </div>
        )}
      </div>

      {/* Resultado */}
      <div className="flex items-center justify-between mb-2.5 shrink-0">
        <p className="text-xs font-semibold text-slate-500">
          {hasAnyFilter
            ? `${results.length} resultado${results.length === 1 ? '' : 's'} encontrado${results.length === 1 ? '' : 's'}`
            : `${reports.length} relatório${reports.length === 1 ? '' : 's'} no total`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
        {results.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            <div className="bg-slate-100 p-3.5 rounded-2xl mb-3 text-slate-400">
              <SearchX className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-600 font-sans">Nenhum relatório encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {hasAnyFilter
                ? 'Ajuste ou limpe os filtros para ampliar a busca.'
                : 'Ainda não há relatórios cadastrados.'}
            </p>
          </div>
        ) : (
          results.map((report) => (
            <div
              key={report.id}
              className="p-3 flex gap-3 hover:bg-slate-50/80 transition-colors"
            >
              <ReportThumbnail report={report} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {report.numeroRelatorio || '—'}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 truncate">{report.evento}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatDate(report.data)}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{report.regional}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <Shield className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{report.comando}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{report.responsavel}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => onViewReport(report)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Visualizar em Tela Cheia"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onLoadEditReport(report)}
                  className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                  title="Carregar para Edição"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onGenerateSinglePDF(report)}
                  className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  title="Gerar PDF"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
