import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, User, Users, FileText, CheckCircle, RotateCcw, AlertCircle, Sparkles, Camera, X, Loader2, Hash, Shield } from 'lucide-react';
import { EventReport, PhotoChange } from '../types';
import { compressImageFile } from '../utils/imageCompress';
import logoImg from '../assets/images/sgt_armas_logo_ui.jpg';

interface ReportFormProps {
  editingReport: EventReport | null;
  onSave: (reportData: Omit<EventReport, 'id' | 'createdAt' | 'fotoUrl'>, photoChange: PhotoChange) => void;
  onCancelEdit: () => void;
}

export default function ReportForm({ editingReport, onSave, onCancelEdit }: ReportFormProps) {
  const [numeroRelatorio, setNumeroRelatorio] = useState('');
  const [evento, setEvento] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [regional, setRegional] = useState('');
  const [comando, setComando] = useState('');
  const [participantes, setParticipantes] = useState('');
  const [descricao, setDescricao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [conferidoPor, setConferidoPor] = useState('');

  // Foto do evento: photoPreview guarda só uma foto NOVA recém-selecionada (ainda não salva).
  // A foto já existente do relatório é sempre uma data URL base64 (editingReport.fotoUrl),
  // disponível de imediato — sem precisar de nenhuma busca assíncrona.
  const existingPhotoUrl = editingReport?.fotoUrl || null;
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // O que efetivamente aparece no preview: uma foto nova tem prioridade; se o usuário
  // removeu explicitamente, mostra nada; senão, mostra a foto já existente (se houver).
  const displayedPhotoUrl = photoPreview || (photoRemoved ? null : existingPhotoUrl);
  
  // Validation errors state
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showSuccessHint, setShowSuccessHint] = useState(false);

  // Set form fields if editingReport is provided
  useEffect(() => {
    if (editingReport) {
      setNumeroRelatorio(editingReport.numeroRelatorio || '');
      setEvento(editingReport.evento);
      setData(editingReport.data);
      setHora(editingReport.hora);
      setRegional(editingReport.regional);
      setComando(editingReport.comando || '');
      setParticipantes(editingReport.participantes);
      setDescricao(editingReport.descricao);
      setResponsavel(editingReport.responsavel);
      setConferidoPor(editingReport.conferidoPor || '');
      setPhotoPreview(null);
      setPhotoBlob(null);
      setPhotoRemoved(false);
      setPhotoError('');
      setErrors({});
    } else {
      clearForm();
    }
  }, [editingReport]);

  const clearForm = () => {
    setNumeroRelatorio('');
    setEvento('');
    setData('');
    setHora('');
    setRegional('');
    setComando('');
    setParticipantes('');
    setDescricao('');
    setResponsavel('');
    setConferidoPor('');
    setPhotoPreview(null);
    setPhotoBlob(null);
    setPhotoRemoved(false);
    setPhotoError('');
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      setPhotoBlob(compressed.blob);
      setPhotoPreview(compressed.dataUrl);
      setPhotoRemoved(false);
    } catch (err: any) {
      setPhotoError(err?.message || 'Não foi possível processar a foto selecionada.');
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoBlob(null);
    setPhotoRemoved(true);
    setPhotoError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!numeroRelatorio.trim()) newErrors.numeroRelatorio = 'O número do relatório é obrigatório.';
    if (!evento.trim()) newErrors.evento = 'O nome do evento é obrigatório.';
    if (!data) {
      newErrors.data = 'A data do evento é obrigatória.';
    } else {
      const [year, month, day] = data.split('-').map(Number);
      const parsed = new Date(year, month - 1, day);
      const isRealDate =
        parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
      if (!isRealDate) newErrors.data = 'A data informada não é válida.';
    }
    if (!hora) newErrors.hora = 'O horário é obrigatório.';
    if (!regional.trim()) newErrors.regional = 'A regional é obrigatória.';
    if (!comando.trim()) newErrors.comando = 'O comando é obrigatório.';
    if (!descricao.trim()) {
      newErrors.descricao = 'A descrição detalhada é obrigatória.';
    } else if (descricao.length > 10000) {
      newErrors.descricao = `A descrição excede o limite de 10.000 caracteres (atual: ${descricao.length}).`;
    }
    if (participantes.length > 5000) {
      newErrors.participantes = `A lista de participantes excede o limite de 5.000 caracteres (atual: ${participantes.length}).`;
    }
    if (!responsavel.trim()) newErrors.responsavel = 'O responsável é obrigatório.';
    if (!conferidoPor.trim()) newErrors.conferidoPor = 'O conferente é obrigatório.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    let photoChange: PhotoChange;
    if (photoBlob && photoPreview) {
      photoChange = { type: 'new', blob: photoBlob, previewDataUrl: photoPreview };
    } else if (photoRemoved) {
      photoChange = { type: 'removed' };
    } else {
      photoChange = { type: 'unchanged' };
    }

    onSave({
      numeroRelatorio: numeroRelatorio.trim(),
      evento: evento.trim(),
      data,
      hora,
      regional: regional.trim(),
      comando: comando.trim(),
      participantes: participantes.trim(),
      descricao: descricao.trim(),
      responsavel: responsavel.trim(),
      conferidoPor: conferidoPor.trim(),
    }, photoChange);

    if (!editingReport) {
      // Show short success hint
      setShowSuccessHint(true);
      setTimeout(() => setShowSuccessHint(false), 3000);
      clearForm();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col h-full overflow-hidden">
      {/* Form Header */}
      <div className="mb-5 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 shadow-xs">
            <img 
              src={logoImg} 
              alt="Insanos MC Logo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold font-sans tracking-tight text-slate-800">
              {editingReport ? 'Editar Relatório' : 'Participação - Contenção - Sgt Armas'}
            </h2>
            <p className="text-xs text-slate-400">
              {editingReport ? 'Altere os campos para atualizar os dados.' : 'Preencha os campos abaixo e clique em Salvar.'}
            </p>
          </div>
        </div>
      </div>

      {/* Form container scrollable */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
        {/* Success Hint */}
        {showSuccessHint && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Relatório salvo com sucesso no banco de dados local!</span>
          </div>
        )}

        {/* Número do Relatório */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 block">Número do relatório *</label>
          <div className="relative">
            <input
              type="text"
              id="input-numero-relatorio"
              value={numeroRelatorio}
              onChange={(e) => setNumeroRelatorio(e.target.value)}
              placeholder="Ex: 001/2026"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                errors.numeroRelatorio ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
              } outline-none focus:ring-3 transition-all`}
            />
            <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          {errors.numeroRelatorio && (
            <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.numeroRelatorio}
            </p>
          )}
        </div>

        {/* Evento */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 block">Evento *</label>
          <div className="relative">
            <input
              type="text"
              id="input-evento"
              value={evento}
              onChange={(e) => setEvento(e.target.value)}
              placeholder="Ex: Reunião Geral de Alinhamento"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                errors.evento ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
              } outline-none focus:ring-3 transition-all`}
            />
            <Sparkles className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          {errors.evento && (
            <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.evento}
            </p>
          )}
        </div>

        {/* Grid para Data e Hora */}
        <div className="grid grid-cols-2 gap-3">
          {/* Data */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 block">Data *</label>
            <div className="relative">
              <input
                type="date"
                id="input-data"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={`w-full pl-9 pr-2 py-2 text-sm rounded-xl border ${
                  errors.data ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                } outline-none focus:ring-3 transition-all`}
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            {errors.data && (
              <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.data}
              </p>
            )}
          </div>

          {/* Hora */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 block">Hora *</label>
            <div className="relative">
              <input
                type="time"
                id="input-hora"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={`w-full pl-9 pr-2 py-2 text-sm rounded-xl border ${
                  errors.hora ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                } outline-none focus:ring-3 transition-all`}
              />
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            {errors.hora && (
              <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.hora}
              </p>
            )}
          </div>
        </div>

        {/* Grid para Regional e Comando */}
        <div className="grid grid-cols-2 gap-3">
          {/* Regional */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 block">Regional *</label>
            <div className="relative">
              <input
                type="text"
                id="input-regional"
                value={regional}
                onChange={(e) => setRegional(e.target.value)}
                placeholder="Ex: 1ª Regional"
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                  errors.regional ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                } outline-none focus:ring-3 transition-all`}
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            {errors.regional && (
              <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.regional}
              </p>
            )}
          </div>

          {/* Comando */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 block">Comando *</label>
            <div className="relative">
              <input
                type="text"
                id="input-comando"
                value={comando}
                onChange={(e) => setComando(e.target.value)}
                placeholder="Ex: CMD XXIX"
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                  errors.comando ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                } outline-none focus:ring-3 transition-all`}
              />
              <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            {errors.comando && (
              <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.comando}
              </p>
            )}
          </div>
        </div>

        {/* Foto do Evento */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 block">Foto do evento</label>

          {displayedPhotoUrl ? (
            <div className="relative w-full max-w-[220px]">
              <img
                src={displayedPhotoUrl}
                alt="Prévia da foto do evento"
                className="w-full h-36 object-cover rounded-xl border border-slate-200"
              />
              <button
                type="button"
                id="btn-remove-photo"
                onClick={handleRemovePhoto}
                className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md cursor-pointer"
                title="Remover foto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="input-foto"
              className="flex flex-col items-center justify-center gap-1.5 w-full max-w-[220px] h-24 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer text-slate-400"
            >
              {isCompressingPhoto ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-[11px] font-medium">Processando foto...</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span className="text-[11px] font-medium">Adicionar foto</span>
                </>
              )}
            </label>
          )}

          <input
            ref={fileInputRef}
            type="file"
            id="input-foto"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {photoError && (
            <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {photoError}
            </p>
          )}
        </div>

        {/* Participantes */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 block">Participantes</label>
          <div className="relative">
            <textarea
              id="input-participantes"
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              placeholder="Ex: Sidnei Bogas, Ana Souza, Carlos Eduardo..."
              rows={2}
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                errors.participantes ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
              } outline-none focus:ring-3 transition-all resize-none`}
            />
            <Users className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          {errors.participantes && (
            <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.participantes}
            </p>
          )}
        </div>

        {/* Descrição Detalhada */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 block">Descrição detalhada *</label>
          <div className="relative flex-1">
            <textarea
              id="input-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Escreva os pontos discutidos, decisões e próximas etapas com detalhes..."
              rows={4}
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                errors.descricao ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
              } outline-none focus:ring-3 transition-all resize-y min-h-[100px]`}
            />
            <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          {errors.descricao && (
            <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.descricao}
            </p>
          )}
        </div>

        {/* Responsável - Quem fez o relatório */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 block">Quem fez o relatório (Responsável) *</label>
          <div className="relative">
            <input
              type="text"
              id="input-responsavel"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                errors.responsavel ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
              } outline-none focus:ring-3 transition-all`}
            />
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          {errors.responsavel && (
            <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.responsavel}
            </p>
          )}
        </div>

        {/* Conferido por */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 block">Conferido por *</label>
          <div className="relative">
            <input
              type="text"
              id="input-conferido-por"
              value={conferidoPor}
              onChange={(e) => setConferidoPor(e.target.value)}
              placeholder="Nome de quem conferiu o relatório"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                errors.conferidoPor ? 'border-rose-400 bg-rose-50/10 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
              } outline-none focus:ring-3 transition-all`}
            />
            <CheckCircle className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          {errors.conferidoPor && (
            <p className="text-[10px] text-rose-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.conferidoPor}
            </p>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
          {editingReport ? (
            <>
              <button
                type="submit"
                id="form-submit-update"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-50 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Atualizar
              </button>
              <button
                type="button"
                id="form-cancel-edit"
                onClick={onCancelEdit}
                className="bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-600 border border-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Cancelar
              </button>
            </>
          ) : (
            <div className="flex gap-2 w-full">
              <button
                type="submit"
                id="form-submit-save"
                className="flex-[2] bg-slate-800 hover:bg-slate-900 active:bg-black text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                Salvar Relatório
              </button>
              <button
                type="button"
                id="form-clear-fields"
                onClick={clearForm}
                className="flex-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                title="Limpar todos os campos do formulário"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                Limpar
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
