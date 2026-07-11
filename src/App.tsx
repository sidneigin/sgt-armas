import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  LogIn, 
  LogOut, 
  RefreshCw
} from 'lucide-react';
import type { EventReport, PhotoChange } from './types';
import { validateEventReport } from './utils/validateReport';
import { translateFirebaseError } from './utils/firebaseErrors';
import ReportForm from './components/ReportForm';
import ReportList from './components/ReportList';
import ReportModal from './components/ReportModal';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  subscribeToReports, 
  saveReportToFirestore, 
  deleteReportFromFirestore, 
  syncLocalReportsToFirestore
} from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import logoImg from './assets/images/sgt_armas_logo_ui.jpg';

export default function App() {
  const [reports, setReports] = useState<EventReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<EventReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [activeViewReport, setActiveViewReport] = useState<EventReport | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Firebase Auth & Sync States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load auth state on mount
  useEffect(() => {
    const unsubscribe = initAuth((currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    }, () => {
      setUser(null);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // Load reports from Firestore once logado. O app é 100% na nuvem — sem login,
  // nenhum conteúdo é exibido (ver tela de acesso restrito no return abaixo).
  useEffect(() => {
    if (!authChecked || !user) {
      setReports([]);
      return;
    }

    setIsSyncing(true);

    // Migra para o Firestore qualquer relatório que tenha ficado salvo apenas
    // localmente (de versões antigas do app, antes do login se tornar obrigatório).
    const stored = localStorage.getItem('event_reports');
    if (stored) {
      try {
        const localReports: EventReport[] = JSON.parse(stored)
          // Nunca sincroniza relatórios de exemplo (dados de demonstração)
          // para o banco compartilhado de verdade.
          .filter((r: EventReport) => !r.id.startsWith('mock-'));
        if (localReports.length > 0) {
          syncLocalReportsToFirestore(localReports, user.uid)
            .then(({ succeeded, failed }) => {
              if (failed.length === 0) {
                localStorage.removeItem('event_reports');
                triggerAlert('Relatórios locais sincronizados com o Firestore!');
              } else {
                localStorage.setItem('event_reports', JSON.stringify(failed));
                triggerAlert(
                  `${succeeded.length} relatório(s) sincronizado(s). ${failed.length} falharam e serão sincronizados na próxima vez.`,
                  'error'
                );
              }
            })
            .catch((err) => {
              console.error('Erro na sincronização inicial:', err);
              triggerAlert('Falha ao sincronizar relatórios locais com o servidor.', 'error');
            });
        } else {
          localStorage.removeItem('event_reports');
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Subscribe to real-time reports from Firestore (todos os relatórios, de todos os usuários)
    const unsubscribeReports = subscribeToReports(
      (firestoreReports) => {
        setReports(firestoreReports);
        setIsSyncing(false);
      },
      (error: any) => {
        console.error('Erro Firestore:', error);
        triggerAlert(`Erro ao carregar relatórios: ${translateFirebaseError(error)}`, 'error');
        setIsSyncing(false);
      }
    );

    return () => unsubscribeReports();
  }, [user, authChecked]);

  // Save/trigger alert messages
  const triggerAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setAlertInfo({ message, type });
    setTimeout(() => setAlertInfo(null), 4000);
  };

  // Google Login and Logout Handlers
  const handleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        triggerAlert(`Bem-vindo, ${res.user.displayName}! Sincronizando relatórios...`);
      }
    } catch (error: any) {
      console.error(error);
      triggerAlert(`Falha ao autenticar com o Google: ${translateFirebaseError(error, 'Tente novamente.')}`, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await googleSignOut();
      setUser(null);
      triggerAlert('Sessão encerrada com sucesso.');
    } catch (error) {
      console.error(error);
      triggerAlert('Falha ao desconectar.', 'error');
    }
  };

  // Create or Update Report (sempre no Firestore — o formulário só é exibido logado)
  const handleSaveReport = async (
    reportData: Omit<EventReport, 'id' | 'createdAt' | 'fotoUrl'>,
    photoChange: PhotoChange
  ) => {
    if (!user) {
      triggerAlert('Você precisa estar logado para salvar um relatório.', 'error');
      return;
    }

    // Validação central: garante que dados malformados nunca cheguem ao Firestore,
    // mesmo que algum fluxo futuro chame esta função sem passar pela validação do formulário.
    const validation = validateEventReport(reportData);
    if (!validation.valid) {
      triggerAlert(`Não foi possível salvar: ${validation.errors[0]}`, 'error');
      return;
    }

    try {
      if (editingReport) {
        // Update existing
        const updatedReport: EventReport = {
          ...editingReport,
          ...reportData,
        };

        // Aplica a alteração de foto: nova, removida, ou mantém a atual.
        // A foto é sempre salva como base64 direto no documento (sem Firebase Storage e sem custo).
        if (photoChange.type === 'new') {
          updatedReport.fotoUrl = photoChange.previewDataUrl;
        } else if (photoChange.type === 'removed') {
          delete updatedReport.fotoUrl;
        }
        // 'unchanged' -> mantém fotoUrl já herdado de editingReport

        await saveReportToFirestore(updatedReport, user.uid);
        triggerAlert('Relatório atualizado com sucesso!');
        setEditingReport(null);
      } else {
        // Create new
        const newReport: EventReport = {
          id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ...reportData,
          createdAt: Date.now()
        };

        if (photoChange.type === 'new') {
          newReport.fotoUrl = photoChange.previewDataUrl;
        }

        await saveReportToFirestore(newReport, user.uid);
        triggerAlert('Relatório cadastrado com sucesso!');
        setSelectedReportId(newReport.id);
      }
    } catch (error: any) {
      console.error(error);
      triggerAlert(`Erro ao salvar o relatório: ${translateFirebaseError(error)}`, 'error');
    }
  };

  // Delete Report (sempre no Firestore — a lista só é exibida logado)
  const handleDeleteReport = async (id: string) => {
    if (!user) {
      triggerAlert('Você precisa estar logado para excluir um relatório.', 'error');
      return;
    }

    try {
      await deleteReportFromFirestore(id);

      if (selectedReportId === id) {
        setSelectedReportId(null);
      }
      if (editingReport?.id === id) {
        setEditingReport(null);
      }
      triggerAlert('Relatório excluído com sucesso!', 'success');
    } catch (error: any) {
      console.error(error);
      triggerAlert(`Erro ao excluir o relatório: ${translateFirebaseError(error)}`, 'error');
    }
  };

  // Selection handlers
  const handleSelectReport = (id: string) => {
    setSelectedReportId(id);
  };

  const handleDoubleSelectReport = (report: EventReport) => {
    setSelectedReportId(report.id);
    setActiveViewReport(report);
    setIsViewModalOpen(true);
  };

  const handleViewReport = (report: EventReport) => {
    setActiveViewReport(report);
    setIsViewModalOpen(true);
  };

  const handleLoadEditReport = (report: EventReport) => {
    setEditingReport(report);
    // Scroll to form on mobile devices
    const formElement = document.getElementById('input-evento');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCancelEdit = () => {
    setEditingReport(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Top Header Navigation */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center shrink-0">
              <img 
                src={logoImg} 
                alt="Insanos MC Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-bold tracking-tight font-sans">
                Relatório Sgt Armas CMD XXIX - IMC
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase hidden sm:block">
                Santinão Cmd Armas IV
              </p>
            </div>
          </div>

          {/* Auth & Backup Action buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] bg-emerald-950/40 text-emerald-300 py-1.5 px-3 rounded-lg border border-emerald-500/30">
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {isSyncing ? 'Sincronizando...' : 'Nuvem Sincronizada'}
                </span>
                
                {/* User Info Avatar & Sign Out */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/60 rounded-xl p-1 pr-3">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'Usuário'} 
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <span className="text-xs text-slate-200 font-medium hidden md:inline max-w-[120px] truncate">
                    {user.displayName?.split(' ')[0]}
                  </span>
                  <button
                    id="btn-google-signout"
                    onClick={handleLogout}
                    className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Sair da Conta Google"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="btn-google-signin"
                onClick={handleLogin}
                className="flex items-center gap-2 text-xs font-semibold py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
                title="Fazer login com Google para habilitar sincronização em tempo real"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar com Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:grid md:grid-cols-12 gap-6 min-h-0">
        
        {/* Floating Global Notification Alert */}
        {alertInfo && (
          <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 max-w-md animate-bounce ${
            alertInfo.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            {alertInfo.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <p className="text-xs font-medium font-sans leading-tight">{alertInfo.message}</p>
          </div>
        )}

        {!authChecked ? (
          // Ainda confirmando se há sessão salva
          <div className="col-span-12 flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin" />
            <p className="text-sm">Verificando sessão...</p>
          </div>
        ) : !user ? (
          // Acesso restrito: só mostra conteúdo depois de logar
          <div className="col-span-12 flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <img src={logoImg} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Acesso restrito</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                Entre com sua conta Google para ver, cadastrar e gerenciar os relatórios.
              </p>
            </div>
            <button
              id="btn-google-signin-gate"
              onClick={handleLogin}
              className="flex items-center gap-2 text-sm font-semibold py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar com Google</span>
            </button>
          </div>
        ) : (
          <>
            {/* Left Side: Form Panel */}
            <section className="col-span-12 md:col-span-5 h-[calc(100vh-190px)] min-h-[500px] md:h-[calc(100vh-190px)]">
              <ReportForm
                editingReport={editingReport}
                onSave={handleSaveReport}
                onCancelEdit={handleCancelEdit}
              />
            </section>

            {/* Right Side: List and Search Panel */}
            <section className="col-span-12 md:col-span-7 h-[calc(100vh-190px)] min-h-[500px] md:h-[calc(100vh-190px)]">
              <ReportList
                reports={reports}
                selectedReportId={selectedReportId}
                onSelectReport={handleSelectReport}
                onDoubleSelectReport={handleDoubleSelectReport}
                onViewReport={handleViewReport}
                onLoadEditReport={handleLoadEditReport}
                onDeleteReport={handleDeleteReport}
                onGenerateSinglePDF={(report) => import('./utils/pdfGenerator').then(({ generateSingleReportPDF }) => generateSingleReportPDF(report))}
                onGenerateConsolidatedPDF={(filteredReports) => import('./utils/pdfGenerator').then(({ generateConsolidatedReportsPDF }) => generateConsolidatedReportsPDF(filteredReports))}
              />
            </section>
          </>
        )}
      </main>

      {/* View Modal Overlay */}
      <ReportModal
        report={activeViewReport}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setActiveViewReport(null);
        }}
      />

      {/* Flat simple footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 text-center text-slate-500 text-[11px] font-mono">
        Relatório Sgt Armas CMD XXIX - IMC © 2026 • Sid Sgt Armas
      </footer>
    </div>
  );
}
