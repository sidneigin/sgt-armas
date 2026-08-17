import { useState } from 'react';
import { BookOpen, Plus, ExternalLink, Pencil, Trash2, X, AlertCircle, FileText } from 'lucide-react';
import { Manual } from '../types';

interface ManualsPanelProps {
  manuals: Manual[];
  isAdmin: boolean;
  onSave: (manual: Omit<Manual, 'id' | 'createdAt' | 'criadoPor'> & { id?: string }) => Promise<void> | void;
  onDelete: (manualId: string) => void;
}

interface FormState {
  id?: string;
  titulo: string;
  descricao: string;
  url: string;
}

const emptyForm: FormState = { titulo: '', descricao: '', url: '' };

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ManualsPanel({ manuals, isAdmin, onSave, onDelete }: ManualsPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<{ titulo?: string; url?: string }>({});
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function openNewForm() {
    setForm(emptyForm);
    setErrors({});
    setIsFormOpen(true);
  }

  function openEditForm(manual: Manual) {
    setForm({ id: manual.id, titulo: manual.titulo, descricao: manual.descricao || '', url: manual.url });
    setErrors({});
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleSubmit() {
    const newErrors: { titulo?: string; url?: string } = {};
    if (!form.titulo.trim()) newErrors.titulo = 'Informe um título para o manual.';
    if (!form.url.trim()) newErrors.url = 'Cole o link do PDF (Google Drive, Dropbox etc.).';
    else if (!isValidUrl(form.url)) newErrors.url = 'Link inválido. Deve começar com http:// ou https://';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: form.id,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || undefined,
        url: form.url.trim(),
      });
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Manuais Insanos</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Materiais em PDF disponibilizados para leitura</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 sm:px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Manual</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {manuals.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-400 dark:text-slate-500 py-10">
            <FileText className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium">Nenhum manual disponível ainda.</p>
            {isAdmin && <p className="text-xs">Clique em "Adicionar Manual" para cadastrar o primeiro PDF.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {manuals.map((manual) => (
              <div
                key={manual.id}
                className="group flex flex-col gap-2.5 p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                    <FileText className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug break-words">{manual.titulo}</p>
                    {manual.descricao && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{manual.descricao}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  <a
                    href={manual.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir PDF
                  </a>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => openEditForm(manual)}
                        title="Editar manual"
                        className="flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 p-2 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {pendingDeleteId === manual.id ? (
                        <>
                          <button
                            onClick={() => {
                              onDelete(manual.id);
                              setPendingDeleteId(null);
                            }}
                            title="Confirmar exclusão"
                            className="text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-2 rounded-lg transition-colors cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(null)}
                            title="Cancelar"
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 px-2 py-2 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setPendingDeleteId(manual.id)}
                          title="Excluir manual"
                          className="flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 p-2 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de cadastro/edição (só admin) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {form.id ? 'Editar Manual' : 'Novo Manual'}
              </h3>
              <button onClick={closeForm} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Título *</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Manual de Conduta do Clube"
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${
                    errors.titulo ? 'border-rose-400' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-100 dark:focus:ring-indigo-800'
                  } outline-none focus:ring-3 transition-all bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100`}
                />
                {errors.titulo && (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.titulo}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Descrição (opcional)</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Uma breve descrição do conteúdo do manual"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-100 dark:focus:ring-indigo-800 outline-none focus:ring-3 transition-all bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Link do PDF *</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  className={`w-full px-3 py-2 text-sm rounded-xl border ${
                    errors.url ? 'border-rose-400' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-100 dark:focus:ring-indigo-800'
                  } outline-none focus:ring-3 transition-all bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100`}
                />
                {errors.url ? (
                  <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.url}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Cole aqui o link compartilhável do Google Drive, Dropbox ou outro serviço (com acesso liberado para leitura).
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60">
              <button
                onClick={closeForm}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Adicionar manual'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
