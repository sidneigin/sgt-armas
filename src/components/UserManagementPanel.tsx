import { useMemo, useState, type ReactNode } from 'react';
import { UserCheck, UserX, ShieldCheck, Clock, RotateCcw, UserCog, Trash2, Users as UsersIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface UserManagementPanelProps {
  profiles: UserProfile[];
  currentAdminEmail: string;
  currentUid: string;
  onApprove: (uid: string) => void;
  onReject: (uid: string) => void;
  onRevoke: (uid: string) => void;
  onChangeRole: (uid: string, role: 'admin' | 'user') => void;
  onDelete: (uid: string) => void;
}

type PendingAction = { uid: string; type: 'revoke' | 'delete' | 'role' } | null;

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
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

function UserRow({
  profile,
  meta,
  children,
}: {
  profile: UserProfile;
  meta?: ReactNode;
  children: ReactNode;
}) {
  const isAdminRole = profile.role === 'admin';
  return (
    <div className="flex items-center flex-wrap sm:flex-nowrap gap-3 py-3 px-3 rounded-xl border border-slate-100 bg-slate-50/60">
      {profile.photoURL ? (
        <img
          src={profile.photoURL}
          alt={profile.displayName}
          referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
          {profile.displayName?.charAt(0).toUpperCase() || 'U'}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-700 truncate">{profile.displayName}</p>
          <span
            className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 border ${
              isAdminRole
                ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                : 'text-slate-500 bg-slate-100 border-slate-200'
            }`}
          >
            {isAdminRole ? 'ADMINISTRADOR' : 'USUÁRIO PADRÃO'}
          </span>
        </div>
        <p className="text-xs text-slate-400 truncate">{profile.email}</p>
        {meta && <p className="text-[11px] text-slate-400 truncate mt-0.5">{meta}</p>}
      </div>
      <div className="w-full sm:w-auto shrink-0 flex items-center flex-wrap justify-end sm:justify-start gap-1.5">{children}</div>
    </div>
  );
}

export default function UserManagementPanel({
  profiles,
  currentAdminEmail,
  currentUid,
  onApprove,
  onReject,
  onRevoke,
  onChangeRole,
  onDelete,
}: UserManagementPanelProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const { pending, approved, rejected } = useMemo(() => {
    const pending: UserProfile[] = [];
    const approved: UserProfile[] = [];
    const rejected: UserProfile[] = [];
    for (const p of profiles) {
      if (p.status === 'pending') pending.push(p);
      else if (p.status === 'approved') approved.push(p);
      else rejected.push(p);
    }
    return { pending, approved, rejected };
  }, [profiles]);

  const clearPending = () => setPendingAction(null);

  // Ações de "tornar admin / tornar padrão" e "excluir", reaproveitadas nas
  // seções de aprovados e recusados. A própria conta logada não pode se
  // auto-gerenciar por aqui (evita se rebaixar ou se excluir sem querer).
  function ManagementActions({ profile }: { profile: UserProfile }) {
    const isSelf = profile.uid === currentUid;
    if (isSelf) {
      return <span className="text-[11px] text-slate-400 italic pr-1">sua conta</span>;
    }

    if (pendingAction?.uid === profile.uid && pendingAction.type === 'role') {
      const willBeAdmin = profile.role !== 'admin';
      return (
        <>
          <span className="text-[11px] text-slate-500 pr-1">
            {willBeAdmin ? 'Tornar administrador?' : 'Tornar usuário padrão?'}
          </span>
          <button
            onClick={() => {
              onChangeRole(profile.uid, willBeAdmin ? 'admin' : 'user');
              clearPending();
            }}
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Confirmar
          </button>
          <button
            onClick={clearPending}
            className="text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </>
      );
    }

    if (pendingAction?.uid === profile.uid && pendingAction.type === 'delete') {
      return (
        <>
          <span className="text-[11px] text-slate-500 pr-1">Excluir usuário?</span>
          <button
            onClick={() => {
              onDelete(profile.uid);
              clearPending();
            }}
            className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Confirmar
          </button>
          <button
            onClick={clearPending}
            className="text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </>
      );
    }

    return (
      <>
        <button
          onClick={() => setPendingAction({ uid: profile.uid, type: 'role' })}
          title={profile.role === 'admin' ? 'Tornar usuário padrão' : 'Tornar administrador'}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <UserCog className="w-3.5 h-3.5" />
          {profile.role === 'admin' ? 'Tornar padrão' : 'Tornar admin'}
        </button>
        <button
          onClick={() => setPendingAction({ uid: profile.uid, type: 'delete' })}
          title="Excluir usuário"
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </button>
      </>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col h-full overflow-hidden">
      <div className="mb-5 border-b border-slate-100 pb-4 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
          <UsersIcon className="w-4.5 h-4.5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Gestão de Usuários</h2>
          <p className="text-xs text-slate-400">Aprove, recuse, promova ou remova quem acessa o sistema</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* Pendentes */}
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">
            <Clock className="w-3.5 h-3.5" />
            Pendentes de aprovação ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">Nenhuma solicitação pendente no momento.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((p) => (
                <UserRow key={p.uid} profile={p} meta={`Solicitado em ${formatDate(p.createdAt)}`}>
                  {pendingAction?.uid === p.uid && pendingAction.type === 'delete' ? (
                    <>
                      <span className="text-[11px] text-slate-500 pr-1">Excluir solicitação?</span>
                      <button
                        onClick={() => {
                          onDelete(p.uid);
                          clearPending();
                        }}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={clearPending}
                        className="text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onApprove(p.uid)}
                        title="Aprovar acesso"
                        className="flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => onReject(p.uid)}
                        title="Recusar acesso"
                        className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Recusar
                      </button>
                      <button
                        onClick={() => setPendingAction({ uid: p.uid, type: 'delete' })}
                        title="Excluir solicitação"
                        className="flex items-center text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </UserRow>
              ))}
            </div>
          )}
        </section>

        {/* Aprovados */}
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-600 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Acesso liberado ({approved.length})
          </h3>
          <div className="space-y-2">
            {approved.map((p) => (
              <UserRow
                key={p.uid}
                profile={p}
                meta={
                  p.role === 'admin'
                    ? `Administrador desde ${formatDate(p.approvedAt)}`
                    : `Acesso liberado em ${formatDate(p.approvedAt)}${p.approvedBy ? ` por ${p.approvedBy}` : ''}`
                }
              >
                {pendingAction?.uid === p.uid && pendingAction.type === 'revoke' ? (
                  <>
                    <span className="text-[11px] text-slate-500 pr-1">Revogar acesso?</span>
                    <button
                      onClick={() => {
                        onRevoke(p.uid);
                        clearPending();
                      }}
                      className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={clearPending}
                      className="text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    {p.uid !== currentUid && p.role !== 'admin' && !pendingAction && (
                      <button
                        onClick={() => setPendingAction({ uid: p.uid, type: 'revoke' })}
                        title="Revogar acesso"
                        className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revogar
                      </button>
                    )}
                    <ManagementActions profile={p} />
                  </>
                )}
              </UserRow>
            ))}
          </div>
        </section>

        {/* Recusados */}
        {rejected.length > 0 && (
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
              <UserX className="w-3.5 h-3.5" />
              Recusados ({rejected.length})
            </h3>
            <div className="space-y-2">
              {rejected.map((p) => (
                <UserRow
                  key={p.uid}
                  profile={p}
                  meta={`Recusado ${p.approvedBy && p.approvedBy !== currentAdminEmail ? `por ${p.approvedBy} ` : ''}em ${formatDate(p.approvedAt)}`}
                >
                  {pendingAction?.uid === p.uid && pendingAction.type === 'delete' ? (
                    <>
                      <span className="text-[11px] text-slate-500 pr-1">Excluir usuário?</span>
                      <button
                        onClick={() => {
                          onDelete(p.uid);
                          clearPending();
                        }}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={clearPending}
                        className="text-xs font-semibold text-slate-500 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onApprove(p.uid)}
                        title="Aprovar mesmo assim"
                        className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => setPendingAction({ uid: p.uid, type: 'delete' })}
                        title="Excluir usuário"
                        className="flex items-center text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </UserRow>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
