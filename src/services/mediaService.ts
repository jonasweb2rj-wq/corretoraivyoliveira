import { upload } from '@vercel/blob/client';
import { auth } from '../firebase/config';

export interface UploadedBlobResult {
  url: string;
  pathname: string;
  size: number;
  mimeType: string;
  storageProvider: 'vercel-blob' | 'local-preview';
}

interface ServerMediaCapabilities {
  vercelBlob: boolean;
  clientDirectUpload: boolean;
}

let cachedCapabilities: { value: ServerMediaCapabilities; fetchedAt: number } | null = null;

async function getServerMediaCapabilities(): Promise<ServerMediaCapabilities> {
  if (cachedCapabilities && Date.now() - cachedCapabilities.fetchedAt < 30_000) {
    return cachedCapabilities.value;
  }
  try {
    const resp = await fetch('/api/health');
    if (resp.ok) {
      const data = await resp.json();
      const value: ServerMediaCapabilities = {
        vercelBlob: Boolean(data?.capabilities?.vercelBlob),
        clientDirectUpload: Boolean(data?.capabilities?.clientDirectUpload),
      };
      cachedCapabilities = { value, fetchedAt: Date.now() };
      return value;
    }
  } catch {
    // fallback below
  }
  return { vercelBlob: false, clientDirectUpload: false };
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(dataUrlOrBase64: string, mimeType: string): Blob {
  const clean = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.split(',')[1] : dataUrlOrBase64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

const DEFAULT_WATERMARK_LOGO = '/logo-ivy-oliveira.png';

function loadWatermarkImage(src: string): Promise<HTMLImageElement | null> {
  const tryLoad = (url: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const logo = new Image();
      if (!url.startsWith('/') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        logo.crossOrigin = 'anonymous';
      }
      logo.onload = () => (logo.naturalWidth > 0 ? resolve(logo) : resolve(null));
      logo.onerror = () => resolve(null);
      logo.src = url;
    });

  return tryLoad(src).then((img) => {
    if (img || src === DEFAULT_WATERMARK_LOGO) return img;
    return tryLoad(DEFAULT_WATERMARK_LOGO);
  });
}

function drawBrandWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  logoImg: HTMLImageElement
): void {
  const minDim = Math.min(width, height);
  const logoW = Math.round(Math.max(110, Math.min(width * 0.19, minDim * 0.28, 340)));
  const logoH = Math.round(logoW * (logoImg.naturalHeight / Math.max(1, logoImg.naturalWidth)));
  const marginX = Math.round(Math.max(18, width * 0.032));
  const marginY = Math.round(Math.max(18, height * 0.042));
  const x = Math.max(12, width - logoW - marginX);
  const y = Math.max(12, height - logoH - marginY);

  ctx.save();

  // Soft diffused pearl halo (no hard rectangle) so black & gold lettering reads on any dark or bright surface
  const cx = x + logoW / 2;
  const cy = y + logoH / 2;
  const radius = Math.max(logoW, logoH) * 0.72;
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
  halo.addColorStop(0, 'rgba(255, 253, 248, 0.28)');
  halo.addColorStop(0.65, 'rgba(255, 253, 248, 0.10)');
  halo.addColorStop(1, 'rgba(255, 253, 248, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.88;
  ctx.shadowColor = 'rgba(255, 253, 248, 0.8)';
  ctx.shadowBlur = Math.max(5, Math.round(logoW * 0.035));
  ctx.drawImage(logoImg, x, y, logoW, logoH);

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.88;
  ctx.drawImage(logoImg, x, y, logoW, logoH);

  ctx.restore();
}

// High-clarity image compression (2400px architectural photos, 4096px 360° panoramas, 0.90 WebP/PNG)
export async function optimizeImageFile(
  file: File,
  options?: {
    watermarkLogoUrl?: string;
    isPanorama?: boolean;
    preserveTransparency?: boolean;
  }
): Promise<{ blob: Blob; mimeType: string; base64?: string }> {
  if (!file.type.startsWith('image/')) {
    return { blob: file, mimeType: file.type || 'application/octet-stream' };
  }

  const watermarkImg = options?.watermarkLogoUrl
    ? await loadWatermarkImage(options.watermarkLogoUrl)
    : null;

  // Preserve crisp lossless alpha PNGs when small and no watermark is applied
  if (
    options?.preserveTransparency &&
    file.type === 'image/png' &&
    !watermarkImg &&
    file.size <= 1_800_000
  ) {
    return { blob: file, mimeType: 'image/png' };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(objUrl);
      const maxDim = options?.isPanorama ? 4096 : 2400;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve({ blob: file, mimeType: file.type });
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (watermarkImg) {
        drawBrandWatermark(ctx, canvas.width, canvas.height, watermarkImg);
      }

      const toBlobWithMime = (mime: string, quality: number) =>
        new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality));

      const keepPng = options?.preserveTransparency && file.type === 'image/png' && !watermarkImg;
      let outMime = keepPng ? 'image/png' : 'image/webp';
      let blob = await toBlobWithMime(outMime, keepPng ? 1 : 0.9);

      if (blob && blob.size > 3_200_000 && !keepPng) {
        for (const q of [0.86, 0.82, 0.78]) {
          const candidate = await toBlobWithMime('image/webp', q);
          if (candidate) {
            blob = candidate;
            if (candidate.size <= 3_200_000) break;
          }
        }
      }

      if (!blob) {
        return resolve({ blob: file, mimeType: file.type });
      }

      // If input was already WebP and didn't shrink (and no watermark applied), keep original
      if (!watermarkImg && file.type === outMime && blob.size >= file.size) {
        return resolve({ blob: file, mimeType: file.type });
      }

      resolve({ blob, mimeType: outMime });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Falha ao processar imagem.'));
    };
    img.src = objUrl;
  });
}

function selectBestVideoRecorderMime(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    { mimeType: 'video/webm;codecs=vp9,opus', ext: '.webm' },
    { mimeType: 'video/webm;codecs=vp9', ext: '.webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: '.webm' },
    { mimeType: 'video/webm', ext: '.webm' },
    { mimeType: 'video/mp4', ext: '.mp4' },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return null;
}

// Quality-preserving browser video compression (up to 1080p Full HD, ~4.2 Mbps VP9/VP8/MP4)
export async function optimizeVideoFile(
  file: File,
  onProgress?: (label: string) => void
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  const defaultExt = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.mp4';
  const defaultMime =
    file.type === 'video/webm' || file.type === 'video/mp4' || file.type === 'video/quicktime'
      ? file.type
      : 'video/mp4';

  const recorderFormat = selectBestVideoRecorderMime();
  if (!recorderFormat) {
    return { blob: file, mimeType: defaultMime, ext: defaultExt };
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const objUrl = URL.createObjectURL(file);
    let settled = false;

    const finishOriginal = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objUrl);
      resolve({ blob: file, mimeType: defaultMime, ext: defaultExt });
    };

    const metadataTimeout = window.setTimeout(finishOriginal, 10_000);

    video.onerror = () => {
      window.clearTimeout(metadataTimeout);
      finishOriginal();
    };

    video.onloadedmetadata = async () => {
      window.clearTimeout(metadataTimeout);
      const srcW = video.videoWidth || 1280;
      const srcH = video.videoHeight || 720;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;

      // Already compact web-ready MP4/WebM at <= 1080p: keep original bitstream without quality loss
      if (
        (file.type === 'video/mp4' || file.type === 'video/webm') &&
        file.size <= 8 * 1024 * 1024 &&
        Math.max(srcW, srcH) <= 1920
      ) {
        return finishOriginal();
      }

      // Skip excessively long real-time transcodes (> 90s) in client browser to keep UX fast; Vercel Blob direct client upload handles up to 150 MB
      if (duration > 90) {
        return finishOriginal();
      }

      const maxDim = file.size > 40 * 1024 * 1024 ? 1280 : 1920;
      let targetW = srcW;
      let targetH = srcH;
      if (Math.max(srcW, srcH) > maxDim) {
        const scale = maxDim / Math.max(srcW, srcH);
        targetW = Math.round((srcW * scale) / 2) * 2;
        targetH = Math.round((srcH * scale) / 2) * 2;
      } else {
        targetW = Math.max(2, Math.round(srcW / 2) * 2);
        targetH = Math.max(2, Math.round(srcH / 2) * 2);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return finishOriginal();

      const canvasStream = canvas.captureStream(30);
      try {
        const videoStream =
          (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
            .captureStream?.() ||
          (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
        if (videoStream) {
          videoStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
        }
      } catch {
        // Silent fallback if browser blocks captureStream audio
      }

      const bitrate = Math.min(4_500_000, Math.max(2_000_000, Math.round(targetW * targetH * 2.0)));
      const chunks: Blob[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(canvasStream, {
          mimeType: recorderFormat.mimeType,
          videoBitsPerSecond: bitrate,
        });
      } catch {
        return finishOriginal();
      }

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(objUrl);
        const compressed = new Blob(chunks, { type: recorderFormat.mimeType.split(';')[0] });
        if (
          compressed.size > 0 &&
          (compressed.size < file.size || file.type === 'video/quicktime')
        ) {
          resolve({
            blob: compressed,
            mimeType: recorderFormat.mimeType.split(';')[0],
            ext: recorderFormat.ext,
          });
        } else {
          resolve({ blob: file, mimeType: defaultMime, ext: defaultExt });
        }
      };

      let rafId = 0;
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, targetW, targetH);
        if (duration > 0) {
          const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
          onProgress?.(`Comprimindo vídeo (${pct}%)...`);
        }
        rafId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        cancelAnimationFrame(rafId);
        if (recorder.state !== 'inactive') recorder.stop();
      };

      try {
        onProgress?.('Comprimindo vídeo mantendo alta qualidade...');
        recorder.start(250);
        await video.play();
        rafId = requestAnimationFrame(drawFrame);
      } catch {
        cancelAnimationFrame(rafId);
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
        }
        finishOriginal();
      }
    };

    video.src = objUrl;
  });
}

// Non-destructive real photo enhancement (lighting, exposure, contrast, sharpness without altering geometry)
export async function enhancePhotoPreservingReality(
  imageUrl: string,
  options: { brightness: number; contrast: number; warmth: number; sharpness: boolean }
): Promise<{ blob: Blob; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1600;
      canvas.height = img.naturalHeight || 1066;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas indisponível.'));

      const brightPct = 100 + options.brightness;
      const contrastPct = 100 + options.contrast;
      const saturatePct = 100 + Math.round(options.warmth * 0.4);
      ctx.filter = `brightness(${brightPct}%) contrast(${contrastPct}%) saturate(${saturatePct}%)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (options.warmth > 0) {
        ctx.filter = 'none';
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(255, 210, 150, ${Math.min(0.18, options.warmth / 200)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }

      canvas.toBlob(
        async (blob) => {
          if (!blob) return reject(new Error('Erro ao exportar imagem aprimorada.'));
          const base64 = await fileToBase64(blob);
          resolve({ blob, base64, mimeType: 'image/webp' });
        },
        'image/webp',
        0.92
      );
    };
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem para aprimoramento.'));
    img.src = imageUrl;
  });
}

function buildSafeBlobPath(tenantId: string, folder: string, filename: string): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'general';
  const extMatch = filename.match(/\.[a-zA-Z0-9]+$/);
  const safeExt = extMatch ? extMatch[0].toLowerCase().slice(0, 10) : '.bin';
  const baseName = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48) || 'media';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${safeTenant}/${safeFolder}/${suffix}-${baseName}${safeExt}`;
}

export async function uploadMediaToServer(params: {
  tenantId: string;
  file?: File;
  blob?: Blob;
  base64Data?: string;
  filename: string;
  mimeType: string;
  folder?: string;
  watermarkLogoUrl?: string;
  isPanorama?: boolean;
  preserveTransparency?: boolean;
  onProgress?: (label: string) => void;
}): Promise<UploadedBlobResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  let blobToUpload: Blob | undefined = params.blob;
  let mimeType = params.mimeType;
  let filename = params.filename;

  if (params.file && !params.base64Data && !blobToUpload) {
    if (params.file.type.startsWith('image/')) {
      params.onProgress?.('Otimizando foto mantendo alta resolução...');
      const optimized = await optimizeImageFile(params.file, {
        watermarkLogoUrl: params.watermarkLogoUrl,
        isPanorama: params.isPanorama,
        preserveTransparency: params.preserveTransparency,
      });
      blobToUpload = optimized.blob;
      mimeType = optimized.mimeType;
      const ext = mimeType === 'image/png' ? '.png' : '.webp';
      filename = filename.replace(/\.[^.]+$/, '') + ext;
    } else if (params.file.type.startsWith('video/')) {
      const optimized = await optimizeVideoFile(params.file, params.onProgress);
      blobToUpload = optimized.blob;
      mimeType = optimized.mimeType;
      filename = filename.replace(/\.[^.]+$/, '') + optimized.ext;
    } else {
      blobToUpload = params.file;
    }
  } else if (!blobToUpload && params.base64Data) {
    blobToUpload = base64ToBlob(params.base64Data, mimeType);
  }

  if (!blobToUpload) {
    throw new Error('Nenhum conteúdo de arquivo disponível para envio.');
  }

  const folder = params.folder || 'properties';
  const capabilities = await getServerMediaCapabilities();

  // Direct client-side streaming to Vercel Blob when configured (no 4.5 MB serverless body limit)
  let directUploadError: unknown = null;
  if (capabilities.vercelBlob && capabilities.clientDirectUpload) {
    try {
      params.onProgress?.('Enviando para Vercel Blob...');
      const objectPath = buildSafeBlobPath(params.tenantId, folder, filename);
      const blobResult = await upload(objectPath, blobToUpload, {
        access: 'public',
        handleUploadUrl: '/api/blob/client-upload',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        contentType: mimeType,
        multipart: blobToUpload.size > 4 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          params.onProgress?.(`Enviando (${Math.round(percentage)}%)...`);
        },
      });
      return {
        url: blobResult.url,
        pathname: blobResult.pathname,
        size: blobToUpload.size,
        mimeType,
        storageProvider: 'vercel-blob',
      };
    } catch (err) {
      directUploadError = err;
      // If file fits serverless JSON fallback (< 3 MB), try server upload endpoint before surfacing error
      if (blobToUpload.size > 3 * 1024 * 1024) {
        throw err instanceof Error ? err : new Error('Falha ao enviar arquivo para o Vercel Blob.');
      }
    }
  }

  params.onProgress?.('Salvando arquivo no servidor...');
  const base64Data = params.base64Data || (await fileToBase64(blobToUpload));
  const resp = await fetch('/api/blob/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tenantId: params.tenantId,
      filename,
      mimeType,
      base64Data,
      folder,
    }),
  });

  if (!resp.ok) {
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const err = await resp.json().catch(() => ({}));
      if (err?.error) throw new Error(err.error);
    }
    if (resp.status === 413) {
      throw new Error('Arquivo muito grande para envio direto ao servidor. Verifique o Vercel Blob nas variáveis de ambiente.');
    }
    if (resp.status === 503) {
      throw new Error('Armazenamento Vercel Blob não configurado. Adicione BLOB_READ_WRITE_TOKEN nas variáveis de ambiente da Vercel.');
    }
    if (directUploadError instanceof Error && directUploadError.message) {
      throw new Error(directUploadError.message);
    }
    throw new Error(`Falha no upload de mídia (HTTP ${resp.status}).`);
  }
  return resp.json();
}

export async function deleteMediaOnServer(tenantId: string, url: string, pathname?: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return;
  await fetch('/api/blob/delete', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenantId, url, pathname }),
  });
}
