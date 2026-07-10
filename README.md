# SGT Armas — Relatório CMD XXIX - IMC

Sistema web para cadastro, consulta e exportação de relatórios de eventos, com foto, sincronização em tempo real e geração de PDF.

## Funcionalidades

- **Login obrigatório com Google** — o conteúdo só é exibido depois de autenticar
- **Acesso compartilhado**: qualquer pessoa autenticada pode criar, ver, editar e excluir todos os relatórios
- **Sincronização em tempo real** via Firebase Firestore
- **Foto do evento** anexada ao relatório (comprimida automaticamente no navegador e salva direto no Firestore — sem custo de armazenamento extra)
- **Exportação em PDF** individual (com foto) ou consolidado (tabela com todos os relatórios filtrados)
- **Busca e filtro por período** na listagem
- **Painel de estatísticas** (total de relatórios, eventos por período, etc.)

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

Sempre que `firestore.rules` for alterado, é preciso publicar de novo:

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
