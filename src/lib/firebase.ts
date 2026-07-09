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
  deleteField
} from 'firebase/firestore';
import { EventReport } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Use environment variables if set (e.g. on Vercel), fallback to sandbox applet config
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
          evento: data.evento,
          data: data.data,
          hora: data.hora,
          local: data.local,
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
