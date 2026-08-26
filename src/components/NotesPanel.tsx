import { useState, FormEvent, useMemo } from 'react';
import { StickyNote, Plus, Pencil, Trash2, CheckCircle, X, AlertCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Note } from '../types';

interface NotesPanelProps {
  notes: Note[];
  onSave: (titulo: string, conteudo: string, data?: string, existingId?: string) => void;
  onDelete: (id: string) => void;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatarDataBR(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatarMesAno(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatDateTime(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotesPanel({ notes, onSave, onDelete }: NotesPanelProps) {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [data, setData] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Agenda: mês visível no calendário e dia selecionado (filtro da lista)
  const [mesAtual, setMesAtual] = useState<Date>(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);

  const hojeISO = toISODate(new Date());

  // Dias do mês atual que possuem ao menos uma anotação com data
  const diasComNota = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      if (n.data) set.add(n.data);
    });
    return set;
  }, [notes]);

  const gridDias = useMemo(() => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const offset = (primeiroDia.getDay() + 6) % 7; // segunda-feira = 0
    const celulas: (number | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
    ];
    return celulas;
  }, [mesAtual]);

  // Lista filtrada pelo dia selecionado (ou todas) e ordenada por data
  const listaExibida = useMemo(() => {
    const base = dataSelecionada ? notes.filter((n) => n.data === dataSelecionada) : notes;
    return [...base].sort((a, b) => {
      const da = a.data || '9999-12-31';
      const db = b.data || '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [notes, dataSelecionada]);

  const selecionarDia = (iso: string) => {
    if (dataSelecionada === iso) {
      setDataSelecionada(null);
      if (!editingId) setData('');
    } else {
      setDataSelecionada(iso);
      if (!editingId) setData(iso);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const tituloTrim = titulo.trim();
    const conteudoTrim = conteudo.trim();

    if (!tituloTrim) {
      setError('O título da anotação é obrigatório.');
      return;
    }
    if (!conteudoTrim) {
      setError('O texto da anotação é obrigatório.');
      return;
    }

    onSave(tituloTrim, conteudoTrim, data || undefined, editingId || undefined);
    setTitulo('');
    setConteudo('');
    setData('');
    setEditingId(null);
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setTitulo(note.titulo);
    setConteudo(note.conteudo);
    setData(note.data || '');
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitulo('');
    setConteudo('');
    setData('');
    setError('');
  };

  const handleConfirmDelete = (id: string) => {
    onDelete(id);
    setPendingDeleteId(null);
  };

  const irMes = (delta: number) => {
    setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="mb-5 border-b border-slate-100 dark:border-slate-700 pb-4 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900 border border-amber-100 dark:border-amber-700 flex items-center justify-center shrink-0">
          <StickyNote className="w-4.5 h-4.5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Agenda</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Crie, agende e gerencie anotações compartilhadas</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {/* Calendário + Formulário */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Calendário */}
          <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => irMes(-1)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">
                {formatarMesAno(mesAtual)}
              </span>
              <button
                type="button"
                onClick={() => irMes(1)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-1">
                  {d}
                </div>
              ))}
              {gridDias.map((d, i) => {
                if (d === null) return <div key={`v${i}`} />;
                const iso = toISODate(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), d));
                const tem = diasComNota.has(iso);
                const selecionado = dataSelecionada === iso;
                const ehHoje = iso === hojeISO;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => selecionarDia(iso)}
                    className={`relative aspect-square flex items-center justify-center rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      selecionado
                        ? 'bg-amber-600 text-white'
                        : tem
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-700'
                          : ehHoje
                            ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title={tem ? `Agenda em ${formatarDataBR(iso)}` : formatarDataBR(iso)}
                  >
                    {d}
                    {tem && !selecionado && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setMesAtual(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
                setDataSelecionada(null);
                if (!editingId) setData('');
              }}
              className="mt-2 w-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
            >
              Hoje
            </button>
          </div>

          {/* Formulário de criação/edição */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              {editingId ? 'Editar anotação' : 'Nova anotação'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Título da anotação"
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                  error
                    ? 'border-rose-400 bg-rose-50/10 dark:bg-rose-900/30 focus:ring-rose-200 dark:focus:ring-rose-700'
                    : 'border-slate-200 dark:border-slate-600 focus:border-amber-400 focus:ring-amber-100 dark:focus:ring-amber-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                } outline-none focus:ring-3 transition-all`}
              />
              <StickyNote className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
            </div>
            <textarea
              value={conteudo}
              onChange={(e) => {
                setConteudo(e.target.value);
                if (error) setError('');
              }}
              placeholder="Escreva o texto da anotação..."
              rows={3}
              className={`w-full px-3 py-2 text-sm rounded-xl border ${
                error
                  ? 'border-rose-400 bg-rose-50/10 dark:bg-rose-900/30 focus:ring-rose-200 dark:focus:ring-rose-700'
                  : 'border-slate-200 dark:border-slate-600 focus:border-amber-400 focus:ring-amber-100 dark:focus:ring-amber-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100'
              } outline-none focus:ring-3 transition-all resize-y`}
            />
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 focus:border-amber-400 focus:ring-amber-100 dark:focus:ring-amber-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-3 transition-all"
              />
            </div>
            <div className="flex gap-2">
              {editingId ? (
                <>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-semibold py-2 px-3.5 rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              )}
            </div>
            {error && (
              <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {error}
              </p>
            )}
          </form>
        </div>

        {/* Lista de anotações */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <StickyNote className="w-3.5 h-3.5" />
              {dataSelecionada ? `Agenda de ${formatarDataBR(dataSelecionada)}` : `Agenda (${listaExibida.length})`}
            </h3>
            {dataSelecionada && (
              <button
                type="button"
                onClick={() => {
                  setDataSelecionada(null);
                  if (!editingId) setData('');
                }}
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
              >
                Ver todas
              </button>
            )}
          </div>
          {listaExibida.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-3">
              {dataSelecionada
                ? 'Nenhuma anotação nesta data. Clique em "Adicionar" para criar uma neste dia.'
                : 'Nenhuma anotação cadastrada. Crie a primeira acima.'}
            </p>
          ) : (
            <div className="space-y-2">
              {listaExibida.map((n) => (
                <div
                  key={n.id}
                  className="py-3 px-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 flex items-center justify-center shrink-0">
                      <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">
                          {n.titulo}
                        </p>
                        {n.data && (
                          <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                            {formatarDataBR(n.data)}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words mt-0.5">
                        {n.conteudo}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        {n.updatedAt && n.updatedAt !== n.createdAt ? 'Atualizado em ' : 'Criado em '}
                        {formatDateTime(n.updatedAt || n.createdAt)}
                        {n.criadoPor ? ` por ${n.criadoPor}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {pendingDeleteId === n.id ? (
                        <>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 pr-1">Excluir?</span>
                          <button
                            onClick={() => handleConfirmDelete(n.id)}
                            className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(null)}
                            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Não
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(n)}
                            title="Editar anotação"
                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(n.id)}
                            title="Excluir anotação"
                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
