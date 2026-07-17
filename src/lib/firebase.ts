import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  onSnapshot,
  deleteField,
  getDoc,
  getDocs,
  where,
  limit,
  updateDoc
} from 'firebase/firestore';
import { EventReport, UserProfile } from '../types';
import firebaseConfig from '../../firebase-config.json';

// Use environment variables if set (e.g. on Vercel), fallback to local firebase-config.json
const resolvedFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (firebaseConfig as any).measurementId || ""
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(resolvedFirebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
// OBS: propositalmente não inicializamos o Firebase Storage aqui. Desde 03/02/2026,
// o Firebase Storage passou a exigir o plano pago (Blaze) — no plano gratuito (Spark)
// toda chamada retorna erro. Por isso, a foto do evento é salva como base64 direto
// no documento do Firestore (ver saveReportToFirestore), o que funciona no plano grátis.

const provider = new GoogleAuthProvider();

let isSigningIn = false;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user);
      }
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google Sign-In
export const googleSignIn = async (): Promise<{ user: User } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    return { user: result.user };
  } catch (error) {
    console.error('Erro de login:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Sign-Out
export const googleSignOut = async () => {
  await signOut(auth);
};

/**
 * Firestore CRUD helpers
 */

// Subscribe to real-time updates for ALL reports (app compartilhado: qualquer
// usuário logado vê os relatórios de todos, não só os próprios).
export const subscribeToReports = (
  onUpdate: (reports: EventReport[]) => void,
  onError?: (error: any) => void
) => {
  const q = query(collection(db, 'reports'));

  return onSnapshot(
    q,
    (snapshot) => {
      const reports: EventReport[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        reports.push({
          id: doc.id,
          numeroRelatorio: data.numeroRelatorio,
          evento: data.evento,
          data: data.data,
          hora: data.hora,
          regional: data.regional,
          comando: data.comando,
          participantes: data.participantes,
          descricao: data.descricao,
          responsavel: data.responsavel,
          conferidoPor: data.conferidoPor,
          createdAt: data.createdAt,
          userId: data.userId,
          fotoUrl: data.fotoUrl,
        } as EventReport);
      });
      
      // Sort in memory by createdAt descending
      reports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
      onUpdate(reports);
    },
    (error) => {
      console.error('Erro na sincronização em tempo real:', error);
      if (onError) onError(error);
    }
  );
};

// Add or update a report in Firestore.
// Usa merge:true (para não sobrescrever campos não enviados), mas fotoUrl
// precisa ser declarado explicitamente com deleteField() quando ausente,
// já que merge:true por si só NÃO apaga um campo que simplesmente não veio no objeto.
export const saveReportToFirestore = async (report: EventReport, userId: string) => {
  const reportDocRef = doc(db, 'reports', report.id);
  await setDoc(reportDocRef, {
    ...report,
    userId,
    fotoUrl: report.fotoUrl ?? deleteField(),
  }, { merge: true });
};

// Delete a report from Firestore
export const deleteReportFromFirestore = async (reportId: string) => {
  const reportDocRef = doc(db, 'reports', reportId);
  await deleteDoc(reportDocRef);
};

// Sync multiple local reports to Firestore on first sign-in.
// Each report is synced independently: a failure on one does not block the others,
// and the caller receives back which reports failed (to keep them in localStorage for retry).
export const syncLocalReportsToFirestore = async (
  localReports: EventReport[],
  userId: string
): Promise<{ succeeded: EventReport[]; failed: EventReport[] }> => {
  const results = await Promise.allSettled(
    localReports.map((report) => saveReportToFirestore(report, userId))
  );

  const succeeded: EventReport[] = [];
  const failed: EventReport[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      succeeded.push(localReports[index]);
    } else {
      console.error(`Erro ao sincronizar relatório "${localReports[index]?.evento}":`, result.reason);
      failed.push(localReports[index]);
    }
  });

  return { succeeded, failed };
};

/**
 * Gestão de acesso de usuários (aprovação de login)
 *
 * Qualquer pessoa pode fazer login com Google, mas só consegue USAR o sistema
 * (ver/criar relatórios) depois de ser aprovada por um administrador.
 * Administradores são identificados pelo e-mail, veja ADMIN_EMAILS abaixo.
 */

export const ADMIN_EMAILS = [
  'sidneibogas@gmail.com',
  'claudiosantinao078@gmail.com',
  'imc.sidnei@gmail.com',
];

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());

// Garante que existe um documento de perfil para o usuário logado.
// - Se o e-mail é de administrador: cria/mantém como admin já aprovado.
// - Se já existe um perfil: não mexe (preserva o status definido por um admin).
// - Se é a primeira vez desse usuário E ele já tem relatórios salvos com o
//   próprio uid (ou seja, já usava o sistema antes desse recurso existir):
//   aprova automaticamente, sem precisar pedir aprovação de novo.
// - Caso contrário (usuário realmente novo): cria como "pending".
export const ensureUserProfile = async (user: User): Promise<UserProfile> => {
  const email = user.email || '';
  const profileRef = doc(db, 'users', user.uid);
  const existingSnap = await getDoc(profileRef);

  if (existingSnap.exists()) {
    return existingSnap.data() as UserProfile;
  }

  const nowIso = new Date().toISOString();
  const admin = isAdminEmail(email);

  let status: UserProfile['status'] = 'pending';
  if (admin) {
    status = 'approved';
  } else {
    // Usuário já tinha relatórios salvos com esse uid antes de existir aprovação?
    const priorReports = await getDocs(
      query(collection(db, 'reports'), where('userId', '==', user.uid), limit(1))
    );
    if (!priorReports.empty) {
      status = 'approved';
    }
  }

  const profile: UserProfile = {
    uid: user.uid,
    email,
    displayName: user.displayName || 'Usuário',
    photoURL: user.photoURL || null,
    status,
    role: admin ? 'admin' : 'user',
    createdAt: nowIso,
    ...(status === 'approved' ? { approvedAt: nowIso, approvedBy: admin ? email : 'sistema (acesso anterior)' } : {}),
  };

  await setDoc(profileRef, profile);
  return profile;
};

// Observa em tempo real o status de aprovação do usuário logado
export const subscribeToUserProfile = (
  uid: string,
  onUpdate: (profile: UserProfile | null) => void
) => {
  const profileRef = doc(db, 'users', uid);
  return onSnapshot(profileRef, (snap) => {
    onUpdate(snap.exists() ? (snap.data() as UserProfile) : null);
  });
};

// Observa em tempo real TODOS os perfis de usuário (só chamado por admins na tela de gestão)
export const subscribeToAllUserProfiles = (
  onUpdate: (profiles: UserProfile[]) => void,
  onError?: (error: any) => void
) => {
  const q = query(collection(db, 'users'));
  return onSnapshot(
    q,
    (snapshot) => {
      const profiles: UserProfile[] = [];
      snapshot.forEach((docSnap) => profiles.push(docSnap.data() as UserProfile));
      profiles.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      onUpdate(profiles);
    },
    (error) => {
      console.error('Erro ao carregar usuários:', error);
      if (onError) onError(error);
    }
  );
};

// Aprova, recusa ou revoga o acesso de um usuário (ação restrita a admins pelas regras do Firestore)
export const setUserApprovalStatus = async (
  uid: string,
  status: UserProfile['status'],
  approvedByEmail: string
) => {
  const profileRef = doc(db, 'users', uid);
  await updateDoc(profileRef, {
    status,
    approvedAt: new Date().toISOString(),
    approvedBy: approvedByEmail,
  });
};

// Promove ou rebaixa um usuário entre "admin" e "user" (ação restrita a
// admins pelas regras do Firestore). Ao promover para admin, o status
// também é marcado como aprovado, já que um admin sempre tem acesso.
export const setUserRole = async (
  uid: string,
  role: UserProfile['role'],
  changedByEmail: string
) => {
  const profileRef = doc(db, 'users', uid);
  const updates: Record<string, any> = { role };
  if (role === 'admin') {
    updates.status = 'approved';
    updates.approvedAt = new Date().toISOString();
    updates.approvedBy = changedByEmail;
  }
  await updateDoc(profileRef, updates);
};

// Exclui definitivamente o perfil de acesso de um usuário (ação restrita a
// admins pelas regras do Firestore). Não afeta relatórios já criados por
// essa pessoa. Se ela fizer login de novo, um novo perfil "pending" (ou
// aprovado automaticamente, se já tiver relatórios) será criado.
export const deleteUserProfile = async (uid: string) => {
  await deleteDoc(doc(db, 'users', uid));
};
