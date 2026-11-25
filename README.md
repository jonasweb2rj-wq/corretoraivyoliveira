# Ivy Oliveira Imóveis — Plataforma Imobiliária Premium

Plataforma imobiliária pública de alto padrão com painel administrativo multi-corretor, publicação em tempo real via Firebase Firestore, autenticação via Firebase Authentication, upload seguro para Vercel Blob, estúdio de apresentação com Gemini AI e Visita Virtual 360°/3D com Three.js.

## 1. Instalação
```bash
npm install
```

## 2. Configuração do Firebase (Auto-provisionado no AI Studio)
O arquivo `firebase-applet-config.json` é gerado automaticamente pelo provisionamento integrado do AI Studio (`projectId`, `firestoreDatabaseId`, `apiKey`, `authDomain`), sem necessidade de inserir chaves manualmente.

## 3. Configuração do Firebase Authentication
- Provedor ativo: **Google Sign-In** (`signInWithPopup`).
- Primeiro administrador provisionado automaticamente com base no e-mail verificado configurado nas regras de segurança.
- Ao acessar `/admin` e autenticar com o e-mail administrador, o sistema cria automaticamente os documentos de `admins/{uid}`, `users/{uid}` e o tenant inicial `tenants/ivy-oliveira` no Firestore.

## 4. Configuração do Firestore & Banco de Dados
Coleções isoladas por `tenantId` e `ownerUid`:
- `tenants`, `users`, `admins`, `properties`, `developments`, `landingPages`, `leads`, `testimonials`, `analyticsEvents`, `campaigns`, `media`, `aiJobs`, `auditLogs`.

## 5. Regras de Segurança (`firestore.rules`)
- Validado com `@firebase/eslint-plugin-security-rules` (`npx eslint firestore.rules`).
- Rascunhos (`status: 'draft'`) e dados pessoais (`leads`, `users`) nunca são expostos em consultas públicas.
- Cada corretor só pode ler e editar registros vinculados ao seu próprio `tenantId` e `ownerUid`.

## 6. Configuração do Vercel Blob
- Uploads passam pelo endpoint autenticado `POST /api/blob/upload`, que valida o token Firebase ID do usuário, tipo MIME e tamanho (até 25 MB).
- Em produção na Vercel, defina `BLOB_READ_WRITE_TOKEN` nas variáveis de ambiente para armazenar mídia diretamente na CDN do Vercel Blob.
- Quando `BLOB_READ_WRITE_TOKEN` não estiver definido em ambiente local/preview, o servidor utiliza armazenamento isolado por tenant em `/uploads/:tenantId/`.

## 7. Configuração das APIs de IA (`GEMINI_API_KEY` & Vídeo)
- Análise multimodal de fotografias e geração de descrições comerciais rodam exclusivamente no backend (`POST /api/ai/analyze-photos` e `POST /api/ai/generate-copy`) utilizando `@google/genai` (`gemini-4-hydrogen`).
- **AI Property Cinematic**: Gera apresentações de vídeo cinemáticas (16:9 ou 9:16) no navegador a partir das fotografias reais do imóvel, com opção de integração backend para provedores como Vertex AI Veo (`AI_VIDEO_PROVIDER=vertex-veo`, `GOOGLE_CLOUD_PROJECT`) quando credenciais estiverem configuradas.

## 8. Execução Local, Build e Deploy na Vercel
- Desenvolvimento: `npm run dev` (porta `3000`)
- Verificação de tipos: `npm run lint`
- Build de produção: `npm run build`
- Produção Node/Express: `npm start`
- Deploy na Vercel: Conecte o repositório, configure as variáveis de `.env.example` no painel da Vercel e faça deploy. Atualizações de imóveis, preços, temas e páginas ocorrem diretamente pelo Firestore em tempo real sem necessidade de novo deploy.

## 9. Testes e Isolamento Multi-Corretor
- Revise `security_spec.md` e `firestore.rules.test.ts` com os 12 vetores de ataque testados contra `firestore.rules`.
- Revise e endureça `firestore.rules` no Console do Firebase antes de compartilhar amplamente em produção.
