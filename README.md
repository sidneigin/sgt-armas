# SGT Armas — Relatório CMD XXIX - IMC

Sistema web para cadastro, consulta e exportação de relatórios de eventos, com foto, sincronização em tempo real e geração de PDF.

## Funcionalidades

- **Login obrigatório com Google** — o conteúdo só é exibido depois de autenticar
- **Aprovação de acesso**: após o login, o acesso ao sistema precisa ser liberado por um administrador (veja "Gestão de Usuários" abaixo). Quem já usava o sistema antes desse recurso continua com acesso liberado automaticamente
- **Dashboard com barra lateral**: navegação por abas — **Preencher Relatório**, **Gestão de Relatórios** e (só para administradores) **Gestão de Usuários** — cada uma ocupando a tela toda
- **Gestão de Usuários** (admins): aprova, recusa ou revoga o acesso de qualquer conta Google ao sistema. Administradores são fixos por e-mail (`sidneibogas@gmail.com`, `claudiosantinao078@gmail.com`, `imc.sidnei@gmail.com`)
- **Acesso compartilhado aos relatórios**: qualquer pessoa aprovada pode criar, ver, editar e excluir todos os relatórios
- **Número do relatório**: campo de identificação numérica, presente no formulário, na listagem, no modal de detalhes e nos PDFs
- **Sincronização em tempo real** via Firebase Firestore
- **Foto do evento** anexada ao relatório (comprimida automaticamente no navegador e salva direto no Firestore — sem custo de armazenamento extra)
- **Exportação em PDF**:
  - Individual: layout compacto e profissional, com cabeçalho enxuto e fonte da descrição que se ajusta automaticamente para caber em uma única página
  - Consolidado: tabela com todos os relatórios filtrados (Nº, Evento, Data/Hora, Regional, Comando, Responsável, Conferido por)
- **Busca e filtro por período** na listagem
- **Painel de estatísticas** (total de relatórios, eventos por período, etc.)
- **Ícone do navegador (favicon)** com o brasão "Insanos MC — Sgt de Armas"

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Firebase (Authentication + Firestore) — plano gratuito (Spark)
- jsPDF + jsPDF-AutoTable para geração de PDF

## Rodando localmente

**Pré-requisitos:** Node.js instalado.

```bash
npm install
npm run dev
```

O app abre em `http://localhost:3000`. A configuração do Firebase já vem embutida em `firebase-config.json` (projeto `sgt-armas`) — não é necessário criar um `.env` para rodar localmente.

Se quiser usar um projeto Firebase próprio, copie `.env.example` para `.env` e preencha as variáveis `VITE_FIREBASE_*` com as credenciais do seu projeto.

## Publicando as regras do Firebase

Sempre que `firestore.rules` for alterado, é preciso publicar de novo — tanto pela CLI quanto colando manualmente em Firestore Database → Regras no [Firebase Console](https://console.firebase.google.com/):

```bash
firebase login
firebase use --add   # selecione o projeto sgt-armas (só na primeira vez)
firebase deploy --only firestore:rules
```

## Deploy

O projeto está publicado no Vercel (`sgt-armas.vercel.app`), com deploy automático a cada `git push` na branch `main`.

## Limites do plano gratuito

- **Firestore:** 1 GB de armazenamento total, 50.000 leituras/dia, 20.000 gravações/dia
- Cada foto de evento é comprimida para caber com folga no limite de 1 MiB por documento do Firestore
- O Firebase Storage **não é usado** neste projeto (desde fev/2026 ele exige o plano pago Blaze) — por isso as fotos são salvas como base64 direto no documento do relatório
