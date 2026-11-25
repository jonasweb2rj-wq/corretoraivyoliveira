import { auth } from '../firebase/config';

export interface PhotoAnalysisResult {
  coverIndex: number;
  recommendedOrder: number[];
  overallArchitecturalNotes: string;
  photoAnalyses: Array<{
    index: number;
    roomTag: string;
    caption: string;
    highlights: string[];
  }>;
}

export interface GeneratedCopyResult {
  commercialTitle: string;
  summary: string;
  detailedDescription: string;
  differentials: string[];
  socialCopy: string;
  whatsappCopy: string;
  seoTitle: string;
  seoDescription: string;
}

export async function analyzePropertyPhotos(
  images: Array<{ url: string; mimeType?: string; name?: string }>
): Promise<PhotoAnalysisResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Faça login para analisar fotografias.');

  const resp = await fetch('/api/ai/analyze-photos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ images }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Erro na análise de fotografias.');
  }
  return resp.json();
}

export async function generatePropertyCopy(params: {
  propertyData: Record<string, unknown>;
  style: string;
  observedNotes?: string;
}): Promise<GeneratedCopyResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Faça login para gerar descrições.');

  const resp = await fetch('/api/ai/generate-copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao gerar descrição.');
  }
  return resp.json();
}

export type CinematicStyle =
  | 'Cinematográfico de luxo'
  | 'Arquitetura moderna'
  | 'Tour imobiliário'
  | 'Apresentação comercial'
  | 'Minimalista'
  | 'Lançamento imobiliário';

// Real client-side kinematic video renderer (Ken Burns zoom, travelling, pan, lighting, transitions -> real WebM video)
export async function renderKinematicPropertyVideo(params: {
  imageUrls: string[];
  title: string;
  subtitle: string;
  style: CinematicStyle;
  durationPerSlideSec: number;
  aspectRatio: '16:9' | '9:16';
  onProgress?: (pct: number) => void;
}): Promise<{ blob: Blob; url: string; mimeType: string }> {
  const width = params.aspectRatio === '16:9' ? 1280 : 720;
  const height = params.aspectRatio === '16:9' ? 720 : 1280;

  const validUrls = (params.imageUrls || []).filter((u) => typeof u === 'string' && u.trim().length > 0);
  if (validUrls.length === 0) {
    throw new Error('Adicione ao menos uma fotografia válida para gerar o vídeo.');
  }

  const loadedImages: HTMLImageElement[] = await Promise.all(
    validUrls.map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
          img.src = src;
        })
    )
  );

  const validImages = loadedImages.filter((im) => im && im.naturalWidth > 0 && im.naturalHeight > 0);
  if (validImages.length === 0) {
    throw new Error('Nenhuma fotografia pôde ser decodificada para gerar o vídeo.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D indisponível para renderização.');
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    throw new Error('Este navegador não suporta gravação de vídeo local via canvas.');
  }

  const stream = canvas.captureStream(30);
  const preferredMime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
  const recorder = preferredMime
    ? new MediaRecorder(stream, { mimeType: preferredMime, videoBitsPerSecond: 4_500_000 })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const slideDurationMs = Math.max(1, Number(params.durationPerSlideSec) || 3) * 1000;
  const totalDurationMs = validImages.length * slideDurationMs;

  return new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Falha ao gravar fluxo de vídeo.'));
    recorder.onstop = () => {
      const outputMime = preferredMime || recorder.mimeType || 'video/webm';
      const blob = new Blob(chunks, { type: outputMime });
      const url = URL.createObjectURL(blob);
      resolve({ blob, url, mimeType: outputMime });
    };

    recorder.start();
    let startTime: number | null = null;

    const drawFrame = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = Math.max(0, now - startTime);
      if (elapsed >= totalDurationMs) {
        params.onProgress?.(100);
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }

      const slideIdx = Math.max(
        0,
        Math.min(validImages.length - 1, Math.floor(elapsed / slideDurationMs))
      );
      const slideProgress = Math.max(0, Math.min(1, (elapsed % slideDurationMs) / slideDurationMs));
      const img = validImages[slideIdx];
      if (!img || !img.naturalWidth || !img.naturalHeight) {
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }

      ctx.fillStyle = '#0D0D0C';
      ctx.fillRect(0, 0, width, height);

      // Cover scaling + kinematic motion by style
      const baseScale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const zoomFactor =
        params.style === 'Minimalista'
          ? 1.0 + slideProgress * 0.05
          : 1.0 + slideProgress * 0.12;
      const panX =
        slideIdx % 2 === 0
          ? (slideProgress - 0.5) * 40
          : (0.5 - slideProgress) * 40;

      const drawW = img.naturalWidth * baseScale * zoomFactor;
      const drawH = img.naturalHeight * baseScale * zoomFactor;
      const dx = (width - drawW) / 2 + panX;
      const dy = (height - drawH) / 2;

      // Crossfade alpha at edges
      let alpha = 1;
      if (slideProgress < 0.15) alpha = slideProgress / 0.15;
      if (slideProgress > 0.85) alpha = (1 - slideProgress) / 0.15;

      ctx.save();
      ctx.globalAlpha = Math.max(0.2, Math.min(1, alpha));
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();

      // Subtle architectural vignette & editorial caption
      const grad = ctx.createLinearGradient(0, height * 0.55, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.78)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);

      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `600 ${Math.round(width * 0.032)}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillText(params.title.slice(0, 56), Math.round(width * 0.06), height - Math.round(height * 0.11));

      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = `400 ${Math.round(width * 0.016)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(params.subtitle.slice(0, 72), Math.round(width * 0.06), height - Math.round(height * 0.06));

      params.onProgress?.(Math.min(99, Math.round((elapsed / totalDurationMs) * 100)));
      requestAnimationFrame(drawFrame);
    };

    requestAnimationFrame(drawFrame);
  });
}
