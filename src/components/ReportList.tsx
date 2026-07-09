import { useState } from 'react';
import { Search, Eye, Edit3, Trash2, FileDown, Layers, Calendar, MapPin, User, AlertTriangle } from 'lucide-react';
import { EventReport } from '../types';
import { formatDate } from '../utils/formatDate';
import { applyDateFilter, defaultDateFilter, DateFilterState } from '../utils/dateFilters';
import DateFilterPanel from './DateFilterPanel';
import StatsDashboard from './StatsDashboard';

// Miniatura da foto de um relatório na listagem. A foto é sempre uma data URL
// base64 já disponível em report.fotoUrl, então não precisa de nenhuma busca.
function ReportThumbnail({ report }: { report: EventReport }) {
  if (!report.fotoUrl) {
    return <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200" />;
  }

  return (
    <img
      src={report.fotoUrl}
      alt=""
      className="w-8 h-8 rounded-lg object-cover border border-slate-200"
    />
  );
}

interface ReportListProps {
  reports: EventReport[];
  selectedReportId: string | null;
  onSelectReport: (id: string) => void;
  onDoubleSelectReport: (report: EventReport) => void;
  onViewReport: (report: EventReport) => void;
  onLoadEditReport: (report: EventReport) => void;
  onDeleteReport: (id: string) => void;
  onGenerateSinglePDF: (report: EventReport) => void;
  onGenerateConsolidatedPDF: (filteredReports: EventReport[]) => void;
}

export default function ReportList({
  reports,
  selectedReportId,
  onSelectReport,
  onDoubleSelectReport,
  onViewReport,
  onLoadEditReport,
  onDeleteReport,
  onGenerateSinglePDF,
  onGenerateConsolidatedPDF,
}: ReportListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterState>(defaultDateFilter);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Apply date filter first, then text search on top of it
  const dateFilteredReports = applyDateFilter(reports, dateFilter);
  const filteredReports = dateFilteredReports.filter((report) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      report.evento.toLowerCase().includes(term) ||
      report.local.toLowerCase().includes(term) ||
      report.responsavel.toLowerCase().includes(term) ||
      (report.conferidoPor && report.conferidoPor.toLowerCase().includes(term))
    );
  });

  const isDateFiltered = dateFilter.mode !== 'all';

  const selectedReport = reports.find((r) => r.id === selectedReportId);

  const handleDeleteClick = () => {
    if (!selectedReportId) return;
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    if (selectedReportId) {
      onDeleteReport(selectedReportId);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col h-full overflow-hidden relative">
      
      {/* List Header and Search */}
      <div className="space-y-4 mb-5 pb-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-sans tracking-tight text-slate-800">
              Relatórios Salvos ({filteredReports.length})
            </h2>
            <p className="text-xs text-slate-400">
              Selecione um relatório na lista para realizar ações ou gerar PDF.
            </p>
          </div>
          
          {/* Consolidated Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-pdf-consolidated"
              onClick={() => onGenerateConsolidatedPDF(filteredReports)}
              disabled={filteredReports.length === 0}
              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 disabled:pointer-events-none text-slate-700 text-xs font-semibold py-2 px-3.5 rounded-xl transition-all cursor-pointer"
              title="Gera um PDF em tabela com todos os relatórios que estão listados abaixo"
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              Gerar PDF (todos listados)
            </button>
          </div>
        </div>

        {/* Search Input + Date Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              id="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por evento, local ou responsável..."
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 outline-none focus:ring-3 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-medium font-sans bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
          <DateFilterPanel filter={dateFilter} onChange={setDateFilter} />
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="mb-5">
        <StatsDashboard
          reports={filteredReports}
          totalUnfiltered={reports.length}
          isFiltered={isDateFiltered || searchTerm.trim().length > 0}
        />
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto min-h-[250px] border border-slate-100 rounded-xl">
        {filteredReports.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
            <div className="bg-slate-100 p-3.5 rounded-2xl mb-3 text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-600 font-sans">Nenhum relatório encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {reports.length === 0
                ? 'Cadastre o primeiro relatório utilizando o formulário no painel da esquerda.'
                : 'Não encontramos relatórios correspondentes aos termos buscados.'}
            </p>
          </div>
        ) : (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-slate-100 table-fixed">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="w-12 px-2 py-3"></th>
                  <th scope="col" className="w-1/3 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Evento</th>
                  <th scope="col" className="w-1/6 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                  <th scope="col" className="w-1/5 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Local</th>
                  <th scope="col" className="w-1/6 px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Responsável</th>
                  <th scope="col" className="w-1/8 px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const isSelected = report.id === selectedReportId;
                  return (
                    <tr
                      key={report.id}
                      onClick={() => onSelectReport(report.id)}
                      onDoubleClick={() => onDoubleSelectReport(report)}
                      className={`group hover:bg-slate-50/80 transition-all cursor-pointer text-slate-700 ${
                        isSelected ? 'bg-indigo-50/70 hover:bg-indigo-50/90 text-indigo-950 font-medium' : ''
                      }`}
                    >
                      {/* Miniatura da foto */}
                      <td className="px-2 py-2">
                        <ReportThumbnail report={report} />
                      </td>
                      {/* Evento */}
                      <td className="px-4 py-3 text-sm truncate font-sans">
                        <span className={`block truncate ${isSelected ? 'text-indigo-900 font-bold' : 'text-slate-800'}`}>
                          {report.evento}
                        </span>
                      </td>
                      {/* Data */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(report.data)}
                        </span>
                      </td>
                      {/* Local */}
                      <td className="px-4 py-3 text-sm truncate">
                        <span className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-700 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{report.local}</span>
                        </span>
                      </td>
                      {/* Responsavel */}
                      <td className="px-4 py-3 text-sm truncate">
                        <span className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-700 truncate">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{report.responsavel}</span>
                        </span>
                      </td>
                      {/* Ações rápidas */}
                      <td className="px-4 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
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
                            onClick={() => {
                              onSelectReport(report.id);
                              setShowConfirmDelete(true);
                            }}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Excluir Relatório"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Action Panel underneath */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
        <button
          id="btn-action-view"
          onClick={() => selectedReport && onViewReport(selectedReport)}
          disabled={!selectedReportId}
          className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 active:bg-black disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          Visualizar
        </button>

        <button
          id="btn-action-edit"
          onClick={() => selectedReport && onLoadEditReport(selectedReport)}
          disabled={!selectedReportId}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 disabled:opacity-50 disabled:pointer-events-none text-slate-700 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer"
        >
          <Edit3 className="w-4 h-4 text-indigo-500" />
          Carregar para edição
        </button>

        <button
          id="btn-action-delete"
          onClick={handleDeleteClick}
          disabled={!selectedReportId}
          className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 bg-white hover:bg-rose-50 hover:border-rose-200 active:bg-rose-100 border border-slate-200 disabled:opacity-50 disabled:pointer-events-none text-rose-600 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          Excluir
        </button>

        <button
          id="btn-action-pdf"
          onClick={() => selectedReport && onGenerateSinglePDF(selectedReport)}
          disabled={!selectedReportId}
          className="flex-grow sm:flex-initial flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white disabled:opacity-50 disabled:pointer-events-none text-xs font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
        >
          <FileDown className="w-4 h-4" />
          Gerar PDF (selecionado)
        </button>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      {showConfirmDelete && selectedReport && (
        <div className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-100 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="bg-rose-50 p-2 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800">Confirmar Exclusão</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Deseja realmente excluir o relatório do evento <strong className="text-slate-800">"{selectedReport.evento}"</strong>? Esta ação é permanente e não poderá ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                id="btn-confirm-delete-cancel"
                onClick={() => setShowConfirmDelete(false)}
                className="bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-delete-ok"
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
