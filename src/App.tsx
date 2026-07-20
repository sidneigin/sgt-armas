import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  ClipboardList,
  Search,
  BarChart3,
  Users,
  Clock,
  ShieldAlert,
  CheckCircle, 
  AlertCircle, 
  LogIn, 
  LogOut, 
  RefreshCw
} from 'lucide-react';
import type { EventReport, PhotoChange, UserProfile } from './types';
import { validateEventReport } from './utils/validateReport';
import { translateFirebaseError } from './utils/firebaseErrors';
import ReportForm from './components/ReportForm';
import ReportList from './components/ReportList';
import ReportModal from './components/ReportModal';
import UserManagementPanel from './components/UserManagementPanel';
import SearchPanel from './components/SearchPanel';
const StatsPage = lazy(() => import('./components/StatsPage'));
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  subscribeToReports, 
  saveReportToFirestore, 
  deleteReportFromFirestore, 
  syncLocalReportsToFirestore,
  ensureUserProfile,
  subscribeToUserProfile,
  subscribeToAllUserProfiles,
  setUserApprovalStatus,
  setUserRole,
  deleteUserProfile
} from './lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import logoImg from './assets/images/sgt_armas_logo_ui.jpg';
import watermarkImg from './assets/images/sgt_armas_watermark.png';

export default function App() {
  const [reports, setReports] = useState<EventReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<EventReport | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [activeViewReport, setActiveViewReport] = useState<EventReport | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'search' | 'reports' | 'stats' | 'users'>('form');

  // Firebase Auth & Sync States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Perfil de aprovação de acesso do usuário logado
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // Lista de todos os perfis (só carregada para administradores, na tela de Gestão de Usuários)
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const isAdmin = userProfile?.role === 'admin';

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

  // Garante/observa o perfil de aprovação do usuário logado (controla se ele
  // pode efetivamente usar o sistema, ou se está aguardando aprovação de um admin).
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    let unsubscribeProfile: (() => void) | undefined;
    setProfileLoading(true);

    ensureUserProfile(user)
      .then(() => {
        unsubscribeProfile = subscribeToUserProfile(user.uid, (profile) => {
          setUserProfile(profile);
          setProfileLoading(false);
        });
      })
      .catch((error) => {
        console.error('Erro ao verificar perfil de acesso:', error);
        setProfileLoading(false);
      });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [user]);

  // Administradores observam todos os perfis, para a tela de Gestão de Usuários
  useEffect(() => {
    if (!user || !isAdmin) {
      setAllProfiles([]);
      return;
    }
    const unsubscribe = subscribeToAllUserProfiles(
      (profiles) => setAllProfiles(profiles),
      (error) => {
        console.error('Erro ao carregar usuários:', error);
        triggerAlert('Erro ao carregar a lista de usuários.', 'error');
      }
    );
    return () => unsubscribe();
  }, [user, isAdmin]);

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
    setActiveTab('form');
    // Scroll to form on mobile devices
    const formElement = document.getElementById('input-evento');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleGenerateSinglePDF = (report: EventReport) => {
    import('./utils/pdfGenerator').then(({ generateSingleReportPDF }) => generateSingleReportPDF(report));
  };

  const handleCancelEdit = () => {
    setEditingReport(null);
  };

  // Gestão de Usuários (ações restritas a admins pelas regras do Firestore)
  const pendingUsersCount = allProfiles.filter((p) => p.status === 'pending').length;

  const handleApproveUser = async (uid: string) => {
    if (!user?.email) return;
    try {
      await setUserApprovalStatus(uid, 'approved', user.email);
      triggerAlert('Acesso aprovado com sucesso!');
    } catch (error) {
      console.error(error);
      triggerAlert('Erro ao aprovar usuário.', 'error');
    }
  };

  const handleRejectUser = async (uid: string) => {
    if (!user?.email) return;
    try {
      await setUserApprovalStatus(uid, 'rejected', user.email);
      triggerAlert('Acesso recusado.');
    } catch (error) {
      console.error(error);
      triggerAlert('Erro ao recusar usuário.', 'error');
    }
  };

  const handleRevokeUser = async (uid: string) => {
    if (!user?.email) return;
    try {
      await setUserApprovalStatus(uid, 'rejected', user.email);
      triggerAlert('Acesso revogado.');
    } catch (error) {
      console.error(error);
      triggerAlert('Erro ao revogar acesso do usuário.', 'error');
    }
  };

  const handleChangeUserRole = async (uid: string, role: 'admin' | 'user') => {
    if (!user?.email) return;
    try {
      await setUserRole(uid, role, user.email);
      triggerAlert(role === 'admin' ? 'Usuário promovido a administrador!' : 'Usuário definido como padrão.');
    } catch (error) {
      console.error(error);
      triggerAlert('Erro ao alterar o tipo de acesso do usuário.', 'error');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await deleteUserProfile(uid);
      triggerAlert('Usuário excluído da lista de acesso.');
    } catch (error) {
      console.error(error);
      triggerAlert('Erro ao excluir usuário.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative">

      {/* Marca d'água de fundo: brasão Insanos MC, fixo e semi-transparente,
          atrás de todo o conteúdo, sem interferir nos cliques. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={watermarkImg}
          alt=""
          className="h-[65vmin] w-auto max-w-none opacity-[0.06] select-none"
        />
      </div>

      {/* Top Header Navigation */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center shrink-0">
              <img 
                src={logoImg} 
                alt="Insanos MC Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-[13px] leading-tight sm:text-lg font-bold tracking-tight font-sans sm:truncate">
                <span className="sm:hidden">SGT Armas CMD XXIX</span>
                <span className="hidden sm:inline">Relatório Sgt Armas CMD XXIX - IMC</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase hidden sm:block">
                Santinão Cmd Armas IV
              </p>
            </div>
          </div>

          {/* Auth & Backup Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <span className="hidden lg:flex items-center gap-1.5 text-[11px] bg-emerald-950/40 text-emerald-300 py-1.5 px-3 rounded-lg border border-emerald-500/30">
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                {isSyncing ? 'Sincronizando...' : 'Nuvem Sincronizada'}
              </span>
            ) : (
              <button
                id="btn-google-signin"
                onClick={handleLogin}
                className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold py-2 px-2.5 sm:px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-900/10 transition-all cursor-pointer shrink-0"
                title="Fazer login com Google para habilitar sincronização em tempo real"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Entrar com Google</span>
                <span className="sm:hidden">Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row gap-4 sm:gap-6 min-h-0">
        
        {/* Floating Global Notification Alert */}
        {alertInfo && (
          <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 sm:max-w-md animate-bounce ${
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
          <div className="w-full flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin" />
            <p className="text-sm">Verificando sessão...</p>
          </div>
        ) : !user ? (
          // Acesso restrito: só mostra conteúdo depois de logar
          <div className="w-full flex flex-col items-center justify-center gap-4 py-24 text-center">
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
        ) : profileLoading || !userProfile ? (
          // Confirmando o status de aprovação do usuário
          <div className="w-full flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin" />
            <p className="text-sm">Verificando permissão de acesso...</p>
          </div>
        ) : !isAdmin && userProfile.status === 'pending' ? (
          // Login feito, mas aguardando aprovação de um administrador
          <div className="w-full flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Aguardando aprovação</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                Seu login foi feito com sucesso, mas o acesso ao sistema precisa ser liberado
                por um administrador. Assim que for aprovado, você poderá entrar normalmente.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-semibold py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        ) : !isAdmin && userProfile.status === 'rejected' ? (
          // Acesso recusado por um administrador
          <div className="w-full flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Acesso não autorizado</h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                Um administrador recusou o acesso dessa conta ao sistema. Se você acredita que
                isso é um engano, entre em contato com o Sgt de Armas.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-semibold py-2.5 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        ) : (
          <>
            {/* Left Sidebar: Dashboard Navigation */}
            <aside className="shrink-0 md:w-56">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-2 md:p-3 md:sticky md:top-24">
                <nav className="flex flex-wrap md:flex-col gap-1.5 md:gap-2">
                  <button
                    onClick={() => setActiveTab('form')}
                    className={`flex items-center gap-1.5 md:gap-2.5 flex-1 md:flex-none justify-center md:justify-start px-2 md:px-3 py-2 md:py-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold transition-all cursor-pointer text-center md:text-left ${
                      activeTab === 'form'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>{editingReport ? 'Editando Relatório' : 'Preencher Relatório'}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('search')}
                    className={`flex items-center gap-1.5 md:gap-2.5 flex-1 md:flex-none justify-center md:justify-start px-2 md:px-3 py-2 md:py-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold transition-all cursor-pointer text-center md:text-left ${
                      activeTab === 'search'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    <span>Pesquisar</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`flex items-center gap-1.5 md:gap-2.5 flex-1 md:flex-none justify-center md:justify-start px-2 md:px-3 py-2 md:py-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold transition-all cursor-pointer text-center md:text-left ${
                      activeTab === 'reports'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <span>Gestão de Relatórios</span>
                    <span
                      className={`hidden md:inline-flex ml-auto text-[11px] font-bold rounded-full min-w-[1.5rem] h-6 items-center justify-center px-1.5 ${
                        activeTab === 'reports' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {reports.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex items-center gap-1.5 md:gap-2.5 flex-1 md:flex-none justify-center md:justify-start px-2 md:px-3 py-2 md:py-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold transition-all cursor-pointer text-center md:text-left ${
                      activeTab === 'stats'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <span>Estatísticas</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`flex items-center gap-1.5 md:gap-2.5 flex-1 md:flex-none justify-center md:justify-start px-2 md:px-3 py-2 md:py-3 rounded-xl text-[11px] sm:text-xs md:text-sm font-semibold transition-all cursor-pointer text-center md:text-left ${
                        activeTab === 'users'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <Users className="w-4 h-4 shrink-0" />
                      <span>Gestão de Usuários</span>
                      {pendingUsersCount > 0 && (
                        <span
                          className={`hidden md:flex ml-auto text-[11px] font-bold rounded-full min-w-[1.5rem] h-6 items-center justify-center px-1.5 ${
                            activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {pendingUsersCount}
                        </span>
                      )}
                    </button>
                  )}
                </nav>

                {/* User info: name shown below the nav instead of the top bar */}
                {user && (
                  <div className="flex items-center gap-2 px-1.5 pt-3 mt-2 border-t border-slate-100">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Usuário'}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {user.displayName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {user.displayName || 'Usuário'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    </div>
                    <button
                      id="btn-google-signout"
                      onClick={handleLogout}
                      className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                      title="Sair da Conta Google"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </aside>

            {/* Content Panel: Form, Reports or User Management, one at a time */}
            <section className="flex-1 min-w-0 h-[calc(100vh-260px)] sm:h-[calc(100vh-190px)] min-h-[420px] sm:min-h-[500px]">
              {activeTab === 'form' ? (
                <ReportForm
                  editingReport={editingReport}
                  onSave={handleSaveReport}
                  onCancelEdit={handleCancelEdit}
                />
              ) : activeTab === 'search' ? (
                <SearchPanel
                  reports={reports}
                  onViewReport={handleViewReport}
                  onLoadEditReport={handleLoadEditReport}
                  onGenerateSinglePDF={handleGenerateSinglePDF}
                />
              ) : activeTab === 'stats' ? (
                <Suspense
                  fallback={
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <p className="text-sm">Carregando estatísticas...</p>
                    </div>
                  }
                >
                  <StatsPage reports={reports} />
                </Suspense>
              ) : activeTab === 'users' ? (
                <UserManagementPanel
                  profiles={allProfiles}
                  currentAdminEmail={user?.email || ''}
                  currentUid={user?.uid || ''}
                  onApprove={handleApproveUser}
                  onReject={handleRejectUser}
                  onRevoke={handleRevokeUser}
                  onChangeRole={handleChangeUserRole}
                  onDelete={handleDeleteUser}
                />
              ) : (
                <ReportList
                  reports={reports}
                  selectedReportId={selectedReportId}
                  onSelectReport={handleSelectReport}
                  onDoubleSelectReport={handleDoubleSelectReport}
                  onViewReport={handleViewReport}
                  onLoadEditReport={handleLoadEditReport}
                  onDeleteReport={handleDeleteReport}
                  onGenerateSinglePDF={handleGenerateSinglePDF}
                  onGenerateConsolidatedPDF={(filteredReports) => import('./utils/pdfGenerator').then(({ generateConsolidatedReportsPDF }) => generateConsolidatedReportsPDF(filteredReports))}
                />
              )}
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
