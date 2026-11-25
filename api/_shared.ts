import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { put, del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export const PRIMARY_ADMIN_UID = '6zWtrk2KMVaBY2kW9aGe4FjbPu13';
export const PRIMARY_ADMIN_EMAIL = 'sandrodbillo@hotmail.com';

export interface FirebaseClientPublicConfig {
  apiKey: string;
  projectId: string;
}

export function loadFirebasePublicConfig(): FirebaseClientPublicConfig {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
    path.resolve(currentDir, '..', 'firebase-applet-config.json'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as Partial<FirebaseClientPublicConfig>;
        if (parsed.apiKey && parsed.projectId) {
          return { apiKey: parsed.apiKey, projectId: parsed.projectId };
        }
      } catch {
        // Fallback to env vars below
      }
    }
  }
  return {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
  };
}

export interface ApiRequest extends IncomingMessage {
  body?: unknown;
  ip?: string;
}

export type ApiResponse = ServerResponse & {
  status?: (code: number) => ApiResponse;
  json?: (data: unknown) => void;
};

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function readJsonBody<T = Record<string, unknown>>(req: ApiRequest, maxBytes = 35 * 1024 * 1024): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }
  if (typeof req.body === 'string') {
    return (req.body ? JSON.parse(req.body) : {}) as T;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Simple sliding-window rate limiter per IP
const rateMap = new Map<string, { count: number; resetAt: number }>();
export function checkRateLimit(req: ApiRequest, maxReq: number, windowMs: number): boolean {
  const fwd = req.headers['x-forwarded-for'];
  const clientIp =
    (typeof fwd === 'string' ? fwd.split(',')[0]?.trim() : undefined) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();
  const record = rateMap.get(clientIp);
  if (!record || record.resetAt < now) {
    rateMap.set(clientIp, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxReq) {
    return false;
  }
  record.count += 1;
  return true;
}

export interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export function isAuthorizedApiUser(user: VerifiedUser | null): user is VerifiedUser {
  if (!user) return false;
  if (user.uid === PRIMARY_ADMIN_UID && user.email === PRIMARY_ADMIN_EMAIL) {
    return true;
  }
  return Boolean(user.emailVerified);
}

export async function verifyFirebaseBearer(req: IncomingMessage): Promise<VerifiedUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  const cfg = loadFirebasePublicConfig();
  if (!idToken || !cfg.apiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ localId: string; email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user?.localId || !user.email) return null;
    return {
      uid: user.localId,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
    };
  } catch {
    return null;
  }
}

export function isSafeId(val: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(val);
}

export function isAllowedRemoteUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return host.endsWith('.public.blob.vercel-storage.com') || host.endsWith('.vercel-storage.com');
  } catch {
    return false;
  }
}

const ALLOWED_MEDIA_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
];

function getBlobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function handleHealth(res: ServerResponse): void {
  const cfg = loadFirebasePublicConfig();
  const geminiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  const blobConfigured = Boolean(getBlobToken());
  const blobStoreConfigured = Boolean(process.env.BLOB_STORE_ID?.trim() || blobConfigured);
  sendJson(res, 200, {
    ok: true,
    environment: process.env.VERCEL ? 'vercel' : 'node-server',
    firebaseProjectId: cfg.projectId || null,
    capabilities: {
      geminiAi: geminiConfigured,
      vercelBlob: blobConfigured,
      clientDirectUpload: blobConfigured,
      blobStoreConfigured,
      storageMode: blobConfigured ? 'vercel-blob' : 'local-preview',
      virtualTourPro: true,
    },
  });
}

export async function handleBlobClientUpload(req: ApiRequest, res: ServerResponse): Promise<void> {
  if (!checkRateLimit(req, 60, 60_000)) {
    return sendJson(res, 429, { error: 'Muitas solicitações. Aguarde alguns instantes e tente novamente.' });
  }
  const token = getBlobToken();
  if (!token) {
    return sendJson(res, 503, {
      error: 'BLOB_READ_WRITE_TOKEN não configurado no ambiente do servidor.',
    });
  }

  try {
    const body = await readJsonBody<HandleUploadBody>(req, 1024 * 1024);
    if (!body || typeof body !== 'object' || !('type' in body)) {
      return sendJson(res, 400, { error: 'Payload de upload inválido.' });
    }

    if (body.type === 'blob.generate-client-token') {
      const user = await verifyFirebaseBearer(req);
      if (!isAuthorizedApiUser(user)) {
        return sendJson(res, 401, { error: 'Autenticação administrativa obrigatória para envio de mídia.' });
      }

      const rawPathname = String(body.payload?.pathname || '');
      const segments = rawPathname.split('/').filter(Boolean);
      if (
        segments.length !== 3 ||
        !isSafeId(segments[0]) ||
        !isSafeId(segments[1]) ||
        !/^[a-zA-Z0-9._-]{1,120}$/.test(segments[2])
      ) {
        return sendJson(res, 400, { error: 'Caminho de destino inválido para armazenamento.' });
      }
    }

    const jsonResponse = await handleUpload({
      token,
      request: req,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_MEDIA_MIME,
        maximumSizeInBytes: 150 * 1024 * 1024,
        addRandomSuffix: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      }),
    });

    return sendJson(res, 200, jsonResponse);
  } catch (err) {
    console.error('Client blob upload error:', err);
    return sendJson(res, 400, { error: 'Não foi possível autorizar o envio para o Vercel Blob.' });
  }
}

export async function handleBlobUpload(
  req: ApiRequest,
  res: ServerResponse,
  uploadRoot?: string
): Promise<void> {
  if (!checkRateLimit(req, 40, 60_000)) {
    return sendJson(res, 429, { error: 'Muitas solicitações. Aguarde alguns instantes e tente novamente.' });
  }
  try {
    const user = await verifyFirebaseBearer(req);
    if (!isAuthorizedApiUser(user)) {
      return sendJson(res, 401, { error: 'Autenticação administrativa obrigatória para envio de mídia.' });
    }

    const body = await readJsonBody<{
      tenantId?: string;
      filename?: string;
      mimeType?: string;
      base64Data?: string;
      folder?: string;
    }>(req);

    const { tenantId, filename, mimeType, base64Data, folder } = body;
    if (!tenantId || !isSafeId(tenantId)) {
      return sendJson(res, 400, { error: 'Identificador de corretor inválido.' });
    }
    if (!filename || !mimeType || !base64Data) {
      return sendJson(res, 400, { error: 'Arquivo, tipo MIME e conteúdo são obrigatórios.' });
    }

    if (!ALLOWED_MEDIA_MIME.includes(mimeType)) {
      return sendJson(res, 400, {
        error: 'Formato de arquivo não suportado. Use JPG, PNG, WebP, AVIF, MP4, WebM, MOV ou PDF.',
      });
    }

    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');
    const maxBytes = 25 * 1024 * 1024;
    if (buffer.length === 0 || buffer.length > maxBytes) {
      return sendJson(res, 400, { error: 'Tamanho de arquivo inválido (máximo de 25 MB neste endpoint).' });
    }

    const safeExt = path.extname(filename).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.bin';
    const safeBase =
      path
        .basename(filename, path.extname(filename))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 48) || 'media';
    const safeFolder = folder && isSafeId(folder) ? folder : 'general';
    const uniqueName = `${crypto.randomUUID().slice(0, 8)}-${safeBase}${safeExt}`;
    const objectPath = `${tenantId}/${safeFolder}/${uniqueName}`;

    const blobToken = getBlobToken();
    if (blobToken) {
      const blob = await put(objectPath, buffer, {
        access: 'public',
        contentType: mimeType,
        token: blobToken,
      });
      return sendJson(res, 200, {
        url: blob.url,
        pathname: blob.pathname,
        size: buffer.length,
        mimeType,
        storageProvider: 'vercel-blob',
      });
    }

    if (process.env.VERCEL || !uploadRoot) {
      return sendJson(res, 503, {
        error:
          'BLOB_READ_WRITE_TOKEN não configurado na Vercel. Conecte o Vercel Blob Store nas variáveis de ambiente do projeto.',
      });
    }

    const tenantDir = path.resolve(uploadRoot, tenantId, safeFolder);
    if (!tenantDir.startsWith(uploadRoot + path.sep)) {
      return sendJson(res, 400, { error: 'Caminho de destino inválido.' });
    }
    fs.mkdirSync(tenantDir, { recursive: true });
    const targetFile = path.resolve(tenantDir, uniqueName);
    if (!targetFile.startsWith(tenantDir + path.sep)) {
      return sendJson(res, 400, { error: 'Caminho de arquivo inválido.' });
    }
    fs.writeFileSync(targetFile, buffer);

    return sendJson(res, 200, {
      url: `/uploads/${objectPath}`,
      pathname: objectPath,
      size: buffer.length,
      mimeType,
      storageProvider: 'local-preview',
    });
  } catch (err) {
    console.error('Upload error:', err);
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('token') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('access denied')) {
      return sendJson(res, 502, {
        error: 'BLOB_READ_WRITE_TOKEN inválido ou sem permissão na Vercel. Verifique a variável de ambiente do projeto.',
      });
    }
    return sendJson(res, 500, { error: 'Falha ao armazenar o arquivo no servidor.' });
  }
}

export async function handleBlobDelete(
  req: ApiRequest,
  res: ServerResponse,
  uploadRoot?: string
): Promise<void> {
  if (!checkRateLimit(req, 30, 60_000)) {
    return sendJson(res, 429, { error: 'Muitas solicitações. Aguarde alguns instantes e tente novamente.' });
  }
  try {
    const user = await verifyFirebaseBearer(req);
    if (!isAuthorizedApiUser(user)) {
      return sendJson(res, 401, { error: 'Autenticação obrigatória.' });
    }

    const { tenantId, url, pathname } = await readJsonBody<{
      tenantId?: string;
      url?: string;
      pathname?: string;
    }>(req);

    if (!tenantId || !isSafeId(tenantId)) {
      return sendJson(res, 400, { error: 'tenantId inválido.' });
    }

    const blobToken = getBlobToken();
    if (url && isAllowedRemoteUrl(url) && blobToken) {
      if (pathname && !pathname.startsWith(`${tenantId}/`)) {
        return sendJson(res, 403, { error: 'Acesso negado ao arquivo de outro corretor.' });
      }
      await del(url, { token: blobToken });
      return sendJson(res, 200, { deleted: true, storageProvider: 'vercel-blob' });
    }

    if (uploadRoot && pathname && pathname.startsWith(`${tenantId}/`)) {
      const target = path.resolve(uploadRoot, pathname);
      const tenantBase = path.resolve(uploadRoot, tenantId);
      if (target.startsWith(tenantBase + path.sep) && fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
      return sendJson(res, 200, { deleted: true, storageProvider: 'local-preview' });
    }

    return sendJson(res, 200, { deleted: true });
  } catch (err) {
    console.error('Delete media error:', err);
    return sendJson(res, 500, { error: 'Não foi possível remover o arquivo.' });
  }
}

export async function handleAnalyzePhotos(
  req: ApiRequest,
  res: ServerResponse,
  uploadRoot?: string
): Promise<void> {
  if (!checkRateLimit(req, 20, 60_000)) {
    return sendJson(res, 429, { error: 'Muitas solicitações. Aguarde alguns instantes e tente novamente.' });
  }
  try {
    const user = await verifyFirebaseBearer(req);
    if (!isAuthorizedApiUser(user)) {
      return sendJson(res, 401, { error: 'Faça login como administrador para usar a análise com IA.' });
    }

    const ai = getGenAIClient();
    if (!ai) {
      return sendJson(res, 503, {
        error: 'GEMINI_API_KEY não configurada no servidor. Configure-a nas variáveis de ambiente para ativar a análise multimodal.',
      });
    }

    const { images } = await readJsonBody<{
      images?: Array<{ url: string; base64?: string; mimeType?: string; name?: string }>;
    }>(req);

    if (!Array.isArray(images) || images.length === 0) {
      return sendJson(res, 400, { error: 'Envie ao menos uma fotografia para análise.' });
    }

    const subset = images.slice(0, 8);
    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

    for (const img of subset) {
      if (img.base64) {
        const clean = img.base64.includes(',') ? img.base64.split(',')[1] : img.base64;
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: clean,
          },
        });
      } else if (uploadRoot && img.url.startsWith('/uploads/')) {
        const rel = img.url.replace(/^\/uploads\//, '');
        const resolved = path.resolve(uploadRoot, rel);
        if (resolved.startsWith(uploadRoot + path.sep) && fs.existsSync(resolved)) {
          const buf = fs.readFileSync(resolved);
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: buf.toString('base64'),
            },
          });
        }
      } else if (isAllowedRemoteUrl(img.url)) {
        const imgResp = await fetch(img.url);
        if (imgResp.ok) {
          const buf = Buffer.from(await imgResp.arrayBuffer());
          parts.push({
            inlineData: {
              mimeType: imgResp.headers.get('content-type') || 'image/jpeg',
              data: buf.toString('base64'),
            },
          });
        }
      }
    }

    if (parts.length === 0) {
      return sendJson(res, 400, { error: 'Nenhuma imagem válida pôde ser carregada para análise.' });
    }

    parts.push({
      text: `Analise estas ${parts.length} fotografias imobiliárias em ordem (índice 0 a ${parts.length - 1}).
Regras estritas de veracidade:
1. Identifique apenas o ambiente visível em cada imagem usando estritamente uma destas categorias: "Fachada", "Sala de estar", "Sala de jantar", "Cozinha", "Quarto principal", "Quartos adicionais", "Banheiro", "Varanda", "Área gourmet", "Piscina", "Área externa", "Garagem" ou "Outros ambientes".
2. Descreva acabamentos, revestimentos, iluminação e elementos arquitetônicos claramente visíveis.
3. NÃO invente metragem, quantidade total de quartos/banheiros do imóvel, endereço, localização ou materiais não identificáveis.
4. Sugira uma ordem de apresentação editorial (ex.: Fachada ou Sala de estar primeiro) e indique qual imagem tem maior impacto como capa.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction:
          'Você é um diretor de arte imobiliário e especialista em arquitetura. Responda estritamente em português brasileiro com dados observáveis nas fotos.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coverIndex: { type: Type.INTEGER, description: 'Índice da foto recomendada como capa principal.' },
            recommendedOrder: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: 'Ordem sugerida dos índices das fotos.',
            },
            overallArchitecturalNotes: {
              type: Type.STRING,
              description: 'Resumo dos padrões de acabamento e iluminação observados nas fotos.',
            },
            photoAnalyses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  roomTag: { type: Type.STRING, description: 'Ambiente principal visível.' },
                  caption: { type: Type.STRING, description: 'Legenda editorial curta do ambiente.' },
                  highlights: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return sendJson(res, 200, parsed);
  } catch (err) {
    console.error('AI photo analysis error:', err);
    return sendJson(res, 500, { error: 'Erro ao analisar fotografias com Gemini AI.' });
  }
}

export async function handleGenerateCopy(req: ApiRequest, res: ServerResponse): Promise<void> {
  if (!checkRateLimit(req, 20, 60_000)) {
    return sendJson(res, 429, { error: 'Muitas solicitações. Aguarde alguns instantes e tente novamente.' });
  }
  try {
    const user = await verifyFirebaseBearer(req);
    if (!isAuthorizedApiUser(user)) {
      return sendJson(res, 401, { error: 'Autenticação obrigatória para gerar descrições.' });
    }

    const ai = getGenAIClient();
    if (!ai) {
      return sendJson(res, 503, {
        error: 'GEMINI_API_KEY não configurada no servidor.',
      });
    }

    const { propertyData, style, observedNotes } = await readJsonBody<{
      propertyData?: Record<string, unknown>;
      style?: string;
      observedNotes?: string;
    }>(req);

    if (!propertyData) {
      return sendJson(res, 400, { error: 'Informe os dados técnicos do imóvel antes de gerar textos.' });
    }

    const allowedStyles = ['Luxuoso', 'Familiar', 'Moderno', 'Comercial', 'Objetivo', 'Persuasivo'];
    const chosenStyle = style && allowedStyles.includes(style) ? style : 'Luxuoso';

    const prompt = `Gere uma apresentação comercial completa para o imóvel abaixo no estilo "${chosenStyle}".
Use EXCLUSIVAMENTE os dados verificados fornecidos pelo corretor e as observações visuais aprovadas. Nunca invente características, endereços ou metragens que não estejam presentes.

Dados verificados do imóvel:
${JSON.stringify(propertyData, null, 2)}

Observações visuais das fotos (se houver):
${observedNotes || 'Nenhuma observação adicional.'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'Você é um redator imobiliário de alto padrão no Brasil. Escreva com elegância, clareza e precisão factual, evitando clichês artificiais.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commercialTitle: { type: Type.STRING },
            summary: { type: Type.STRING },
            detailedDescription: { type: Type.STRING },
            differentials: { type: Type.ARRAY, items: { type: Type.STRING } },
            socialCopy: { type: Type.STRING },
            whatsappCopy: { type: Type.STRING },
            seoTitle: { type: Type.STRING },
            seoDescription: { type: Type.STRING },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return sendJson(res, 200, parsed);
  } catch (err) {
    console.error('AI copy error:', err);
    return sendJson(res, 500, { error: 'Erro ao gerar textos comerciais com Gemini AI.' });
  }
}
