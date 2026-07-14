export interface EventReport {
  id: string;
  numeroRelatorio: string; // Número/identificação do relatório (ex: 001/2026)
  evento: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  regional: string;
  comando: string;
  participantes: string;
  descricao: string; // Descrição detalhada
  responsavel: string; // Quem fez o relatório
  conferidoPor: string; // Conferido por
  createdAt: number;
  userId?: string;
  // Foto do evento: sempre uma data URL base64 (JPEG comprimido no navegador),
  // salva diretamente no documento do Firestore — sem Firebase Storage e sem
  // Google Drive, então funciona no plano gratuito. Funciona igual logado ou
  // em modo local/offline.
  fotoUrl?: string;
}

// Representa a alteração de foto vinda do formulário: mantém a atual,
// remove a atual, ou substitui por uma nova (já comprimida no navegador).
export type PhotoChange =
  | { type: 'unchanged' }
  | { type: 'removed' }
  | { type: 'new'; blob: Blob; previewDataUrl: string };

// Perfil de acesso do usuário: controla quem pode usar o sistema.
// Administradores aprovam ou recusam o acesso de novos usuários.
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  status: 'pending' | 'approved' | 'rejected';
  role: 'admin' | 'user';
  createdAt: string; // ISO date
  approvedAt?: string; // ISO date
  approvedBy?: string; // e-mail do admin que aprovou/recusou
}

