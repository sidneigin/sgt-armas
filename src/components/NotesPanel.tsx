import { useState, FormEvent } from 'react';
import { StickyNote, Plus, Pencil, Trash2, CheckCircle, X, AlertCircle } from 'lucide-react';
import { Note } from '../types';

interface NotesPanelProps {
  notes: Note[];
  onSave: (titulo: string, conteudo: string, existingId?: string) => void;
  onDelete: (id: string) => void;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

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

    onSave(tituloTrim, conteudoTrim, editingId || undefined);
    setTitulo('');
    setConteudo('');
    setEditingId(null);
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setTitulo(note.titulo);
    setConteudo(note.conteudo);
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitulo('');
    setConteudo('');
    setError('');
  };

  const handleConfirmDelete = (id: string) => {
    onDelete(id);
    setPendingDeleteId(null);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="mb-5 border-b border-slate-100 dark:border-slate-700 pb-4 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900 border border-amber-100 dark:border-amber-700 flex items-center justify-center shrink-0">
          <StickyNote className="w-4.5 h-4.5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Anotações</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Crie, edite ou remova anotações compartilhadas</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
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
            rows={4}
            className={`w-full px-3 py-2 text-sm rounded-xl border ${
              error
                ? 'border-rose-400 bg-rose-50/10 dark:bg-rose-900/30 focus:ring-rose-200 dark:focus:ring-rose-700'
                : 'border-slate-200 dark:border-slate-600 focus:border-amber-400 focus:ring-amber-100 dark:focus:ring-amber-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100'
            } outline-none focus:ring-3 transition-all resize-y`}
          />
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

        {/* Lista de anotações */}
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            <StickyNote className="w-3.5 h-3.5" />
            Anotações ({notes.length})
          </h3>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-3">
              Nenhuma anotação cadastrada. Crie a primeira acima.
            </p>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="py-3 px-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 flex items-center justify-center shrink-0">
                      <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-words">
                        {n.titulo}
                      </p>
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
