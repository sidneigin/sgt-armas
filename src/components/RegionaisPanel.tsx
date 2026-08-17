import { useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, CheckCircle, X, AlertCircle, Map } from 'lucide-react';
import { Regional } from '../types';

interface RegionaisPanelProps {
  regionais: Regional[];
  onSave: (nome: string, existingId?: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function RegionaisPanel({ regionais, onSave, onDelete }: RegionaisPanelProps) {
  const [nome, setNome] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = nome.trim();
    if (!trimmed) {
      setError('O nome da regional é obrigatório.');
      return;
    }

    const duplicate = regionais.find(
      (r) => r.nome.toLowerCase() === trimmed.toLowerCase() && r.id !== editingId
    );
    if (duplicate) {
      setError('Já existe uma regional com esse nome.');
      return;
    }

    onSave(trimmed, editingId || undefined);
    setNome('');
    setEditingId(null);
  };

  const handleEdit = (regional: Regional) => {
    setEditingId(regional.id);
    setNome(regional.nome);
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNome('');
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
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900 border border-indigo-100 dark:border-indigo-700 flex items-center justify-center shrink-0">
          <Map className="w-4.5 h-4.5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Gestão de Regionais</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Adicione, edite ou remova regionais do sistema</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* Formulário de criação/edição */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
            {editingId ? 'Editar regional' : 'Nova regional'}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Ex: Regional Norte do Paraná"
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                  error
                    ? 'border-rose-400 bg-rose-50/10 dark:bg-rose-900/30 focus:ring-rose-200 dark:focus:ring-rose-700'
                    : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-100 dark:focus:ring-indigo-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                } outline-none focus:ring-3 transition-all`}
              />
              <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
            </div>
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
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
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

        {/* Lista de regionais */}
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            <MapPin className="w-3.5 h-3.5" />
            Regionais cadastradas ({regionais.length})
          </h3>
          {regionais.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-3">
              Nenhuma regional cadastrada. Adicione a primeira acima.
            </p>
          ) : (
            <div className="space-y-2">
              {regionais.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 py-3 px-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {r.nome}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Criado em {formatDate(r.createdAt)}
                      {r.createdBy ? ` por ${r.createdBy}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pendingDeleteId === r.id ? (
                      <>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 pr-1">Excluir?</span>
                        <button
                          onClick={() => handleConfirmDelete(r.id)}
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
                          onClick={() => handleEdit(r)}
                          title="Editar regional"
                          className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => setPendingDeleteId(r.id)}
                          title="Excluir regional"
                          className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      </>
                    )}
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
